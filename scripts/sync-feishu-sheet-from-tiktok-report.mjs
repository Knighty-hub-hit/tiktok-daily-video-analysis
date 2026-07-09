import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeDate, toNumber } from "./site-data-builder.mjs";

const DEFAULT_SHEET_NAME = "TikTok每日视频数据";
const DEFAULT_RANGE_ROWS = 5000;
const inputPath = process.argv[2] ?? "data/tiktok-feishu-latest.json";
const sheetUrl =
  process.env.FEISHU_SHEET_URL ||
  process.env.LARK_SHEET_URL ||
  "https://xinchimcn.feishu.cn/wiki/VUs4wyJ6Mi1MlHkhQkCcrx8hnvh";
const sheetName = process.env.FEISHU_SHEET_NAME || process.env.LARK_SHEET_NAME || DEFAULT_SHEET_NAME;
const configuredSheetId = process.env.FEISHU_SHEET_ID || process.env.LARK_SHEET_ID || "";
const startDate = process.env.SITE_DATA_START_DATE ?? "2026-07-01";

const NUMERIC_HEADERS = new Set([
  "GMV",
  "联盟成交件数",
  "联盟带货视频 GMV",
  "带货视频平均订单金额",
  "预计佣金",
  "预计固定费用",
  "联盟订单量",
  "带货视频曝光次数",
  "联盟点击率",
  "带货视频千次曝光成交金额",
  "已退款的联盟商品数",
  "联盟已退款的 GMV",
  "带货视频评论数",
  "带货视频点赞数",
]);

function getEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) {
      return value;
    }
  }

  return "";
}

function parseUrlToken(url, type) {
  const match = String(url).match(new RegExp(`/${type}/([^/?#]+)`));
  return match?.[1] ?? "";
}

function toColumnName(index) {
  let column = "";
  let value = index;

  while (value > 0) {
    const mod = (value - 1) % 26;
    column = String.fromCharCode(65 + mod) + column;
    value = Math.floor((value - mod) / 26);
  }

  return column;
}

function hasText(value) {
  return String(value ?? "").trim().length > 0;
}

function videoKey(link) {
  const text = String(link ?? "").trim();
  const videoId = text.match(/\/video\/(\d+)/)?.[1];
  return videoId ? `video:${videoId}` : `link:${text}`;
}

function rowKey(row, { linkHeader, dateHeader, titleHeader, creatorHeader }, fallbackIndex) {
  const link = row[linkHeader];

  if (isTikTokLink(link)) {
    return videoKey(link);
  }

  const date = normalizeDate(row[dateHeader]);
  const title = String(row[titleHeader] ?? "").trim();
  const creator = String(row[creatorHeader] ?? "").trim();
  const fallback = [date, title, creator].filter(Boolean).join("|");
  return fallback ? `row:${fallback}|${fallbackIndex}` : `row-index:${fallbackIndex}`;
}

function isTikTokLink(link) {
  return /^https?:\/\/(?:www\.)?tiktok\.com\/@[^/]+\/video\/\d+/.test(String(link ?? "").trim());
}

function normalizeHeader(value) {
  return String(value ?? "").replace(/\s+/g, "").toLowerCase();
}

function findHeader(headers, candidates) {
  const normalized = headers.map(normalizeHeader);

  for (const candidate of candidates) {
    const index = normalized.indexOf(normalizeHeader(candidate));

    if (index >= 0) {
      return headers[index];
    }
  }

  return "";
}

function cellToPrimitive(value) {
  if (Array.isArray(value)) {
    const linkSegment = value.find((item) => item && typeof item === "object" && typeof item.link === "string");

    if (linkSegment) {
      return linkSegment.link;
    }

    return value.map(cellToPrimitive).filter(hasText).join(" ");
  }

  if (value && typeof value === "object") {
    if (typeof value.link === "string") {
      return value.link;
    }

    if (typeof value.text === "string") {
      return value.text;
    }

    if ("value" in value) {
      return cellToPrimitive(value.value);
    }
  }

  return value ?? "";
}

function rowHasData(row) {
  return row.some(hasText);
}

function coerceForSheet(header, value) {
  if (header === "视频发布日期") {
    return normalizeDate(value);
  }

  if (NUMERIC_HEADERS.has(header)) {
    if (!hasText(value)) {
      return "";
    }

    return toNumber(value);
  }

  return String(value ?? "").replace(/[\t\r\n]+/g, " ").trim();
}

function splitDelimitedLine(line, delimiter) {
  const cells = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (quoted && char === '"' && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === delimiter) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }

  cells.push(cell);
  return cells;
}

function parseDelimited(text, delimiter) {
  const rows = [];
  let line = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted && char === '"' && next === '"') {
      line += '""';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
      line += char;
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      rows.push(splitDelimitedLine(line, delimiter));
      line = "";
    } else {
      line += char;
    }
  }

  if (line) {
    rows.push(splitDelimitedLine(line, delimiter));
  }

  return rows.filter(rowHasData);
}

export async function loadPreparedRows(filePath) {
  const raw = await readFile(filePath, "utf8");

  if (path.extname(filePath).toLowerCase() === ".json") {
    const data = JSON.parse(raw);
    const headers = data.headers ?? [];
    const rows = (data.rows ?? []).map((row) => (Array.isArray(row) ? row : row.values));
    return { headers, rows };
  }

  const delimiter = path.extname(filePath).toLowerCase() === ".tsv" ? "\t" : ",";
  const [headers, ...rows] = parseDelimited(raw, delimiter);
  return { headers, rows };
}

async function feishuRequest(apiPath, token, options = {}) {
  const baseUrl = process.env.FEISHU_OPEN_BASE_URL || process.env.LARK_OPEN_BASE_URL || "https://open.feishu.cn";
  const response = await fetch(`${baseUrl}${apiPath}`, {
    ...options,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok || data.code !== 0) {
    throw new Error(`Feishu API failed: ${response.status} ${JSON.stringify(data)}`);
  }

  return data.data ?? data;
}

async function getTenantAccessToken() {
  const appId = getEnv("FEISHU_APP_ID", "LARK_APP_ID");
  const appSecret = getEnv("FEISHU_APP_SECRET", "LARK_APP_SECRET");

  if (!appId || !appSecret) {
    throw new Error("Missing FEISHU_APP_ID/FEISHU_APP_SECRET or LARK_APP_ID/LARK_APP_SECRET.");
  }

  const data = await feishuRequest("/open-apis/auth/v3/tenant_access_token/internal", "", {
    method: "POST",
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret,
    }),
  });

  if (!data.tenant_access_token) {
    throw new Error(`Feishu tenant token response did not include tenant_access_token: ${JSON.stringify(data)}`);
  }

  return data.tenant_access_token;
}

async function resolveSpreadsheetToken(token) {
  const explicitToken = getEnv("FEISHU_SPREADSHEET_TOKEN", "LARK_SPREADSHEET_TOKEN");

  if (explicitToken) {
    return explicitToken;
  }

  const sheetToken = parseUrlToken(sheetUrl, "sheets") || parseUrlToken(sheetUrl, "spreadsheets");

  if (sheetToken) {
    return sheetToken;
  }

  const wikiToken = parseUrlToken(sheetUrl, "wiki");

  if (!wikiToken) {
    throw new Error("Cannot resolve Feishu spreadsheet token from URL. Set FEISHU_SPREADSHEET_TOKEN.");
  }

  const data = await feishuRequest(`/open-apis/wiki/v2/spaces/get_node?token=${encodeURIComponent(wikiToken)}`, token);
  const node = data.node ?? data;
  const objectToken = node.obj_token || node.object_token || node.token;
  const objectType = node.obj_type || node.object_type;

  if (!objectToken || (objectType && !["sheet", "spreadsheet"].includes(objectType))) {
    throw new Error(`Wiki node is not a spreadsheet or cannot expose obj_token: ${JSON.stringify(node)}`);
  }

  return objectToken;
}

async function resolveSheetId(token, spreadsheetToken) {
  if (configuredSheetId) {
    return configuredSheetId;
  }

  const data = await feishuRequest(`/open-apis/sheets/v3/spreadsheets/${spreadsheetToken}/sheets/query`, token);
  const sheets = data.sheets ?? [];
  const match = sheets.find((sheet) => sheet.title === sheetName || sheet.sheet_name === sheetName);

  if (!match) {
    throw new Error(`Cannot find sheet "${sheetName}" in Feishu spreadsheet.`);
  }

  return match.sheet_id;
}

async function readSheetValues(token, spreadsheetToken, sheetId, columnCount, rowCount) {
  const range = `${sheetId}!A1:${toColumnName(columnCount)}${rowCount}`;
  const data = await feishuRequest(
    `/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${encodeURIComponent(range)}`,
    token,
  );
  return data.valueRange?.values ?? data.value_range?.values ?? [];
}

async function writeSheetValues(token, spreadsheetToken, sheetId, values) {
  const columnCount = values[0]?.length ?? 1;
  const range = `${sheetId}!A1:${toColumnName(columnCount)}${values.length}`;
  await feishuRequest(`/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values`, token, {
    method: "PUT",
    body: JSON.stringify({
      valueRange: {
        range,
        values,
      },
    }),
  });
  return range;
}

function rowsToObjects(headers, rows) {
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, cellToPrimitive(row[index])])));
}

function alignObjectToHeaders(row, headers) {
  return headers.map((header) => coerceForSheet(header, row[header]));
}

export function mergeRows({ targetHeaders, existingValues, incomingRows }) {
  const existingHeaders = existingValues[0]?.map((value) => String(value ?? "").trim()) ?? [];
  const existingObjects = existingHeaders.length ? rowsToObjects(existingHeaders, existingValues.slice(1)) : [];
  const incomingObjects = rowsToObjects(targetHeaders, incomingRows);
  const linkHeader = findHeader(targetHeaders, ["视频链接", "视频URL", "视频地址", "TikTok链接", "link"]);
  const dateHeader = findHeader(targetHeaders, ["视频发布日期", "发布日期", "日期", "date"]);
  const titleHeader = findHeader(targetHeaders, ["视频名称", "视频标题", "标题", "title"]);
  const creatorHeader = findHeader(targetHeaders, ["达人用户名", "达人昵称", "达人账号", "达人ID", "creator"]);
  const ordersHeader = findHeader(targetHeaders, ["联盟订单量", "订单量", "orders"]);
  const viewsHeader = findHeader(targetHeaders, ["带货视频曝光次数", "曝光次数", "曝光", "views"]);

  if (!linkHeader || !dateHeader) {
    throw new Error(`Prepared rows must include 视频链接 and 视频发布日期. Headers: ${targetHeaders.join(" | ")}`);
  }

  const mergedByVideo = new Map();

  for (const [index, row] of existingObjects.entries()) {
    const date = normalizeDate(row[dateHeader]);

    if (!date || date < startDate) {
      continue;
    }

    mergedByVideo.set(rowKey(row, { linkHeader, dateHeader, titleHeader, creatorHeader }, index), {
      ...row,
      [dateHeader]: date,
    });
  }

  for (const [index, row] of incomingObjects.entries()) {
    const date = normalizeDate(row[dateHeader]);

    if (!date || date < startDate) {
      continue;
    }

    mergedByVideo.set(rowKey(row, { linkHeader, dateHeader, titleHeader, creatorHeader }, index), {
      ...row,
      [dateHeader]: date,
    });
  }

  const mergedObjects = Array.from(mergedByVideo.values()).sort((a, b) => {
    const dateCompare = String(b[dateHeader] ?? "").localeCompare(String(a[dateHeader] ?? ""));

    if (dateCompare !== 0) {
      return dateCompare;
    }

    return toNumber(b[ordersHeader]) - toNumber(a[ordersHeader]) || toNumber(b[viewsHeader]) - toNumber(a[viewsHeader]);
  });

  return [targetHeaders, ...mergedObjects.map((row) => alignObjectToHeaders(row, targetHeaders))];
}

export async function syncFeishuSheetFromTikTokReport(filePath = inputPath) {
  const { headers, rows } = await loadPreparedRows(filePath);

  if (!headers.length || !rows.length) {
    throw new Error(`Prepared TikTok report is empty: ${filePath}`);
  }

  const token = await getTenantAccessToken();
  const spreadsheetToken = await resolveSpreadsheetToken(token);
  const sheetId = await resolveSheetId(token, spreadsheetToken);
  const columnCount = headers.length;
  const maxRows = Number.parseInt(process.env.FEISHU_MAX_ROWS ?? String(DEFAULT_RANGE_ROWS), 10);
  const existingValues = await readSheetValues(token, spreadsheetToken, sheetId, columnCount, maxRows);
  const mergedValues = mergeRows({ targetHeaders: headers, existingValues, incomingRows: rows });
  const writeRowCount = Math.max(existingValues.length, mergedValues.length);
  const blankRow = Array.from({ length: columnCount }, () => "");
  const valuesToWrite = [...mergedValues];

  while (valuesToWrite.length < writeRowCount) {
    valuesToWrite.push(blankRow);
  }

  const writtenRange = await writeSheetValues(token, spreadsheetToken, sheetId, valuesToWrite);
  const verifyValues = await readSheetValues(token, spreadsheetToken, sheetId, columnCount, mergedValues.length);
  const verifiedDataRows = verifyValues.slice(1).filter(rowHasData).length;
  const dateIndex = headers.indexOf("视频发布日期");
  const latestDate = mergedValues
    .slice(1)
    .map((row) => normalizeDate(row[dateIndex]))
    .filter(Boolean)
    .sort()
    .at(-1);

  return {
    ok: true,
    inputPath: filePath,
    sheetName,
    sheetId,
    incomingRows: rows.length,
    existingRows: Math.max(existingValues.length - 1, 0),
    writtenRows: mergedValues.length - 1,
    verifiedDataRows,
    latestDate,
    range: writtenRange,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await syncFeishuSheetFromTikTokReport();
  console.log(JSON.stringify(result, null, 2));
}
