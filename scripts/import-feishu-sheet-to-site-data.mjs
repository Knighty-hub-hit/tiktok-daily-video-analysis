import { spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import { buildSiteDataFromRows, writeSiteData } from "./site-data-builder.mjs";

const DEFAULT_SHEET_NAME = "TikTok每日视频数据";
const DEFAULT_RANGE_ROWS = 5000;
const outputPath = process.argv[2] ?? "data/site-videos.json";
const sheetUrl =
  process.env.FEISHU_SHEET_URL ||
  process.env.LARK_SHEET_URL ||
  "https://xinchimcn.feishu.cn/wiki/VUs4wyJ6Mi1MlHkhQkCcrx8hnvh";
const sheetName = process.env.FEISHU_SHEET_NAME || process.env.LARK_SHEET_NAME || DEFAULT_SHEET_NAME;
const sheetId = process.env.FEISHU_SHEET_ID || process.env.LARK_SHEET_ID || "";
const readMode = process.env.FEISHU_READ_MODE || process.env.LARK_READ_MODE || "auto";

function getEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) {
      return value;
    }
  }

  return "";
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function nonEmpty(value) {
  return String(value ?? "").trim().length > 0;
}

function rowHasData(row) {
  return Object.entries(row).some(([key, value]) => key !== "__sourceRow" && nonEmpty(value));
}

function cellToPrimitive(value) {
  if (Array.isArray(value)) {
    const linkSegment = value.find((item) => item && typeof item === "object" && typeof item.link === "string");

    if (linkSegment) {
      return linkSegment.link;
    }

    return value.map(cellToPrimitive).filter(nonEmpty).join(" ");
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

function normalizeHeader(value) {
  return String(value ?? "").replace(/\s+/g, "").toLowerCase();
}

function likelyHeaderRow(row) {
  const headers = row.map(normalizeHeader);
  const requiredSignals = [
    "视频链接",
    "video_link",
    "link",
    "视频发布日期",
    "date",
    "达人用户名",
    "creator",
    "gmv",
  ].map(normalizeHeader);
  return requiredSignals.filter((signal) => headers.includes(signal)).length >= 2;
}

function rowsFromValues(values) {
  const normalizedValues = values.map((row) => row.map(cellToPrimitive));
  const headerIndex = normalizedValues.findIndex((row) => row.some(nonEmpty) && likelyHeaderRow(row));

  if (headerIndex < 0) {
    return { headers: [], rows: [] };
  }

  const headers = normalizedValues[headerIndex].map((value) => String(value ?? "").trim());
  const rows = normalizedValues.slice(headerIndex + 1).map((valuesRow, index) => {
    const row = Object.fromEntries(headers.map((header, headerIndex) => [header, valuesRow[headerIndex]]));
    row.__sourceRow = headerIndex + index + 2;
    return row;
  });

  return { headers, rows: rows.filter(rowHasData) };
}

function rowsFromTableSheet(sheet) {
  const headers = Array.isArray(sheet.columns) ? sheet.columns.map((value) => String(value ?? "").trim()) : [];
  const dataRows = Array.isArray(sheet.data) ? sheet.data : [];
  const rows = dataRows.map((valuesRow, index) => {
    const row = Object.fromEntries(headers.map((header, headerIndex) => [header, cellToPrimitive(valuesRow[headerIndex])]));
    row.__sourceRow = index + 2;
    return row;
  });
  return { headers, rows: rows.filter(rowHasData) };
}

function runLarkCli(args) {
  const result = spawnSync("lark-cli", args, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    env: {
      ...process.env,
      LARKSUITE_CLI_NO_SKILLS_NOTIFIER: "1",
      LARKSUITE_CLI_NO_UPDATE_NOTIFIER: "1",
    },
  });
  const parsedStdout = result.stdout ? JSON.parse(result.stdout) : null;

  if (result.status !== 0 && !parsedStdout?.ok) {
    throw new Error(result.stderr || result.stdout || `lark-cli exited with ${result.status}`);
  }

  return parsedStdout;
}

function resolveSpreadsheetTokenWithLarkCli() {
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
    return "";
  }

  const envelope = runLarkCli(["drive", "+inspect", "--url", sheetUrl, "--as", "user"]);
  const data = envelope?.data ?? {};

  if (data.type && data.type !== "sheet") {
    throw new Error(`Feishu URL resolved to ${data.type}, not sheet.`);
  }

  return data.token ?? "";
}

function resolveSheetIdWithLarkCli(spreadsheetToken) {
  if (sheetId) {
    return sheetId;
  }

  const envelope = runLarkCli(["api", "GET", `/open-apis/sheets/v3/spreadsheets/${spreadsheetToken}/sheets/query`]);
  const sheets = envelope?.data?.sheets ?? [];
  const match = sheets.find((sheet) => sheet.title === sheetName || sheet.sheet_name === sheetName);

  if (!match) {
    throw new Error(`Cannot find sheet "${sheetName}" in Feishu spreadsheet.`);
  }

  if (match.resource_type && match.resource_type !== "sheet") {
    throw new Error(`Sheet "${sheetName}" is ${match.resource_type}, not a spreadsheet grid.`);
  }

  return match.sheet_id;
}

function readWithLarkCliValues() {
  const spreadsheetToken = resolveSpreadsheetTokenWithLarkCli();

  if (!spreadsheetToken) {
    return null;
  }

  const resolvedSheetId = resolveSheetIdWithLarkCli(spreadsheetToken);
  const columnCount = Number.parseInt(process.env.FEISHU_MAX_COLUMNS ?? "18", 10);
  const rowCount = Number.parseInt(process.env.FEISHU_MAX_ROWS ?? String(DEFAULT_RANGE_ROWS), 10);
  const range = `${resolvedSheetId}!A1:${toColumnName(columnCount)}${rowCount}`;
  const envelope = runLarkCli(["api", "GET", `/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${range}`]);
  const values = envelope?.data?.valueRange?.values ?? envelope?.data?.value_range?.values ?? [];
  const { headers, rows } = rowsFromValues(values);

  return {
    headers,
    rows,
    sourceLabel: `Feishu:${sheetName}`,
  };
}

function readWithLarkCliTable() {
  const spreadsheetToken = getEnv("FEISHU_SPREADSHEET_TOKEN", "LARK_SPREADSHEET_TOKEN");
  const args = ["sheets", "+table-get"];

  if (spreadsheetToken) {
    args.push("--spreadsheet-token", spreadsheetToken);
  } else {
    args.push("--url", sheetUrl);
  }

  if (sheetId) {
    args.push("--sheet-id", sheetId);
  } else {
    args.push("--sheet-name", sheetName);
  }

  const envelope = runLarkCli(args);
  const sheet = envelope?.data?.sheets?.[0];

  if (!sheet) {
    return { headers: [], rows: [], sourceLabel: `Feishu:${sheetName}` };
  }

  const { headers, rows } = rowsFromTableSheet(sheet);
  return {
    headers,
    rows,
    sourceLabel: `Feishu:${sheet.name ?? sheetName}`,
  };
}

function readWithLarkCli() {
  try {
    const valuesResult = readWithLarkCliValues();

    if (valuesResult) {
      return valuesResult;
    }
  } catch (error) {
    if (getEnv("FEISHU_SPREADSHEET_TOKEN", "LARK_SPREADSHEET_TOKEN") || sheetId) {
      throw error;
    }
  }

  return readWithLarkCliTable();
}

async function feishuRequest(path, token, options = {}) {
  const baseUrl = process.env.FEISHU_OPEN_BASE_URL || process.env.LARK_OPEN_BASE_URL || "https://open.feishu.cn";
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const data = await response.json();

  if (!response.ok || data.code !== 0) {
    throw new Error(`Feishu API failed: ${response.status} ${JSON.stringify(data)}`);
  }

  return data.data ?? data;
}

async function getTenantAccessToken() {
  const appId = getEnv("FEISHU_APP_ID", "LARK_APP_ID");
  const appSecret = getEnv("FEISHU_APP_SECRET", "LARK_APP_SECRET");

  if (!appId || !appSecret) {
    return "";
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
  if (sheetId) {
    return sheetId;
  }

  const data = await feishuRequest(`/open-apis/sheets/v3/spreadsheets/${spreadsheetToken}/sheets/query`, token);
  const sheets = data.sheets ?? [];
  const match =
    sheets.find((sheet) => sheet.sheet_id === sheetId) ||
    sheets.find((sheet) => sheet.title === sheetName || sheet.sheet_name === sheetName);

  if (!match) {
    throw new Error(`Cannot find sheet "${sheetName}" in Feishu spreadsheet.`);
  }

  return match.sheet_id;
}

async function readWithOpenApi() {
  const token = await getTenantAccessToken();

  if (!token) {
    throw new Error("Missing FEISHU_APP_ID/FEISHU_APP_SECRET or LARK_APP_ID/LARK_APP_SECRET.");
  }

  const spreadsheetToken = await resolveSpreadsheetToken(token);
  const resolvedSheetId = await resolveSheetId(token, spreadsheetToken);
  const columnCount = Number.parseInt(process.env.FEISHU_MAX_COLUMNS ?? "18", 10);
  const rowCount = Number.parseInt(process.env.FEISHU_MAX_ROWS ?? String(DEFAULT_RANGE_ROWS), 10);
  const range = `${resolvedSheetId}!A1:${toColumnName(columnCount)}${rowCount}`;
  const data = await feishuRequest(
    `/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${encodeURIComponent(range)}`,
    token,
  );
  const values = data.valueRange?.values ?? data.value_range?.values ?? [];
  const { headers, rows } = rowsFromValues(values);

  return {
    headers,
    rows,
    sourceLabel: `Feishu:${sheetName}`,
  };
}

async function readFeishuSheet() {
  if (readMode === "lark-cli") {
    return readWithLarkCli();
  }

  if (readMode === "openapi") {
    return readWithOpenApi();
  }

  try {
    return await readWithOpenApi();
  } catch (error) {
    if (getEnv("FEISHU_APP_ID", "LARK_APP_ID") || getEnv("FEISHU_APP_SECRET", "LARK_APP_SECRET")) {
      throw error;
    }

    return readWithLarkCli();
  }
}

const { headers, rows, sourceLabel } = await readFeishuSheet();
const siteData = await buildSiteDataFromRows(rows, {
  outputPath,
  sourceHeaders: headers,
  sourceLabel,
});

if (siteData.records.length === 0) {
  if (await fileExists(outputPath)) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          outputPath,
          sourceRows: rows.length,
          siteRecords: 0,
          skippedWrite: true,
          reason: "No July TikTok video rows found in Feishu sheet; existing site data was kept.",
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  throw new Error("No July TikTok video rows found in Feishu sheet, and no existing site data is available.");
}

await writeSiteData(outputPath, siteData);

console.log(
  JSON.stringify(
    {
      ok: true,
      outputPath,
      sourceRows: rows.length,
      siteRecords: siteData.records.length,
      dates: Array.from(new Set(siteData.records.map((record) => record.date))).sort(),
      headers,
    },
    null,
    2,
  ),
);
