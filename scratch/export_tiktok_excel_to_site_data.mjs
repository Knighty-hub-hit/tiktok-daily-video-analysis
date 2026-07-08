import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = process.argv[2];
const outputPath = process.argv[3] ?? "data/site-videos.json";

if (!inputPath) {
  throw new Error("Usage: node scratch/export_tiktok_excel_to_site_data.mjs <xlsx> [output]");
}

const JULY_START = "2026-07-01";
const MAX_PER_DATE = 100;

function normalizeHeader(value) {
  return String(value ?? "").replace(/\s+/g, "").toLowerCase();
}

function getCell(row, headerMap, names) {
  for (const name of names) {
    const index = headerMap.get(normalizeHeader(name));
    if (index !== undefined) {
      return row[index];
    }
  }

  return undefined;
}

function normalizeDate(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const raw = String(value ?? "").trim();
  const match = raw.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);

  if (!match) {
    return "";
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function toNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const raw = String(value ?? "")
    .replace(/[$,，%\s]/g, "")
    .match(/-?\d+(\.\d+)?/);

  return raw ? Number(raw[0]) : 0;
}

function extractCreator(url, fallback) {
  const match = String(url).match(/tiktok\.com\/@([^/]+)/);
  const creator = String(fallback ?? match?.[1] ?? "").trim();

  if (!creator) {
    return "@unknown";
  }

  return creator.startsWith("@") ? creator : `@${creator}`;
}

function videoIdFromLink(link) {
  return String(link).match(/\/video\/(\d+)/)?.[1] ?? "";
}

function isTikTokVideoLink(link) {
  return /^https?:\/\/(?:www\.)?tiktok\.com\/@[^/]+\/video\/\d+/.test(String(link));
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function analysisFromRow({ title, orders, views, ctr, gmv }) {
  const hasOrders = orders > 0;
  const hookType = hasOrders ? "成交验证型" : "流量观察型";
  const hook =
    title && title !== "未命名视频"
      ? `标题围绕“${title}”展开，适合优先观察首屏是否直接露出痛点、商品或结果。`
      : "Excel 未提供标题细节，优先从首帧、字幕和商品露出顺序判断 Hook。";
  const sellingPoint = hasOrders
    ? `该视频已有 ${orders} 个联盟订单，GMV 为 ${gmv}，卖点需要围绕实际成交场景复盘。`
    : `该视频当前订单为 0，但曝光 ${views}，适合从高流量素材中拆解选题、节奏和人群匹配。`;
  const cta =
    ctr > 0
      ? `联盟点击率为 ${ctr}%，CTA 可重点检查是否在字幕、口播或购物车入口出现明确行动提示。`
      : "Excel 未显示有效点击率，CTA 需要结合视频画面和评论区进一步确认。";

  return {
    hookType,
    hook,
    sellingPoint,
    cta,
    reusable: "Excel 排序定位高价值视频 -> 下载原视频 -> 抽关键帧 -> 拆首 3 秒 Hook、卖点证明和下单触发点。",
  };
}

async function loadExistingRecords(filePath) {
  try {
    const data = JSON.parse(await readFile(filePath, "utf8"));
    const records = Array.isArray(data.records) ? data.records : [];
    return new Map(records.map((record) => [record.id, record]));
  } catch {
    return new Map();
  }
}

function mergeDisplayAssets(record, existingRecord) {
  if (!existingRecord) {
    return record;
  }

  return {
    ...record,
    cover: existingRecord.cover ?? record.cover,
    videoFile: existingRecord.videoFile ?? record.videoFile,
    videoReady: existingRecord.videoReady ?? record.videoReady,
    mediaType: existingRecord.mediaType ?? record.mediaType,
    transcriptFile: existingRecord.transcriptFile ?? record.transcriptFile,
    frames: existingRecord.frames?.length ? existingRecord.frames : record.frames,
    script: existingRecord.script?.length ? existingRecord.script : record.script,
    breakdown: existingRecord.breakdown ?? record.breakdown,
    reasons: existingRecord.reasons?.length ? existingRecord.reasons : record.reasons,
    source: record.source,
  };
}

const existingRecordsById = await loadExistingRecords(outputPath);
const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const sheet = workbook.worksheets.getItemAt(0);
const values = sheet.getUsedRange(true).values;
const headers = values[0].map((value) => String(value ?? "").trim());
const headerMap = new Map(headers.map((header, index) => [normalizeHeader(header), index]));

const records = values
  .slice(1)
  .map((row, sourceIndex) => {
    const sourceRow = sourceIndex + 2;
    const link = String(getCell(row, headerMap, ["视频链接"]) ?? "").trim();
    const date = normalizeDate(getCell(row, headerMap, ["视频发布日期"]));
    const title = String(getCell(row, headerMap, ["视频名称"]) ?? "未命名视频").trim();
    const creator = extractCreator(link, getCell(row, headerMap, ["达人用户名"]));
    const gmv = toNumber(getCell(row, headerMap, ["联盟带货视频 GMV", "GMV"]));
    const totalGmv = toNumber(getCell(row, headerMap, ["GMV"]));
    const orders = toNumber(getCell(row, headerMap, ["联盟订单量"]));
    const soldItems = toNumber(getCell(row, headerMap, ["联盟成交件数"]));
    const views = toNumber(getCell(row, headerMap, ["带货视频曝光次数"]));
    const likes = toNumber(getCell(row, headerMap, ["带货视频点赞数"]));
    const comments = toNumber(getCell(row, headerMap, ["带货视频评论数"]));
    const ctr = toNumber(getCell(row, headerMap, ["联盟点击率"]));
    const avgOrder = toNumber(getCell(row, headerMap, ["带货视频平均订单金额"]));
    const rpm = toNumber(getCell(row, headerMap, ["带货视频千次曝光成交金额"]));
    const commission = toNumber(getCell(row, headerMap, ["预计佣金"]));
    const videoId = videoIdFromLink(link);
    const id = videoId || `${date}-${slugify(creator)}-${sourceRow}`;

    return {
      id,
      date,
      creator,
      title,
      product: title || "TikTok Shop 视频",
      category: "TikTok Shop Mexico",
      audience: "Mexico / Spanish",
      language: "Spanish",
      link,
      views,
      likes,
      comments,
      orders,
      soldItems,
      revenue: gmv || totalGmv,
      price: avgOrder,
      ctr,
      rpm,
      commission,
      cover: "/video-cover.png",
      videoFile: `/videos/${id}.mp4`,
      frames: [
        {
          time: "00:00",
          title: "首帧待抽取",
          note: "视频下载后自动替换为真实关键画面，用于判断首秒是否露出人、商品或痛点。",
          image: "/frames/frame-00.png",
        },
        {
          time: "00:03",
          title: "卖点待抽取",
          note: "结合字幕、口播和商品出现位置，拆出最强卖点证明。",
          image: "/frames/frame-02.png",
        },
        {
          time: "00:06",
          title: "CTA 待抽取",
          note: "检查是否出现购买引导、折扣信息、购物车或评论区触发。",
          image: "/frames/frame-06.png",
        },
      ],
      script: [
        {
          time: "00:00",
          english: "Awaiting downloaded video transcript",
          chinese: "等待下载视频后补充真实脚本逐句拆解",
        },
      ],
      breakdown: analysisFromRow({ title, creator, orders, views, ctr, gmv: gmv || totalGmv }),
      reasons: [
        orders > 0
          ? `出单量 ${orders}，按目标规则优先进入成交榜。`
          : `出单量为 0，按曝光 ${views} 参与流量排序。`,
        `点赞 ${likes}、评论 ${comments}，可作为互动强弱依据。`,
        `数据来自 Excel 第 ${sourceRow} 行，字段含视频链接、发布日期、GMV、订单量、曝光、点击率、评论、点赞。`,
      ],
      source: {
        file: path.basename(inputPath),
        row: sourceRow,
        headers: {
          title: "视频名称",
          link: "视频链接",
          date: "视频发布日期",
          creator: "达人用户名",
          revenue: gmv ? "联盟带货视频 GMV" : "GMV",
          orders: "联盟订单量",
          views: "带货视频曝光次数",
          ctr: "联盟点击率",
          likes: "带货视频点赞数",
          comments: "带货视频评论数",
        },
      },
    };
  })
  .map((record) => mergeDisplayAssets(record, existingRecordsById.get(record.id)))
  .filter((record) => isTikTokVideoLink(record.link) && record.date >= JULY_START);

const byDate = new Map();

for (const record of records) {
  const current = byDate.get(record.date) ?? [];
  current.push(record);
  byDate.set(record.date, current);
}

const siteRecords = Array.from(byDate.entries())
  .flatMap(([, dateRecords]) => {
    const hasOrders = dateRecords.some((record) => record.orders > 0);
    return dateRecords
      .sort((a, b) =>
        hasOrders
          ? b.orders - a.orders || b.views - a.views || b.likes - a.likes
          : b.views - a.views || b.likes - a.likes,
      )
      .slice(0, MAX_PER_DATE);
  })
  .sort((a, b) => (a.date === b.date ? b.orders - a.orders || b.views - a.views : b.date.localeCompare(a.date)));

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sourceFile: path.basename(inputPath),
      sourceHeaders: headers,
      julyStart: JULY_START,
      count: siteRecords.length,
      records: siteRecords,
    },
    null,
    2,
  )}\n`,
);

console.log(
  JSON.stringify(
    {
      outputPath,
      sourceRows: records.length,
      siteRecords: siteRecords.length,
      dates: Array.from(new Set(siteRecords.map((record) => record.date))).sort(),
      headers,
    },
    null,
    2,
  ),
);
