import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const SITE_DATA_START_DATE = process.env.SITE_DATA_START_DATE ?? "2026-07-01";
export const MAX_PER_DATE = Number.parseInt(process.env.SITE_DATA_MAX_PER_DATE ?? "100", 10);

export const FIELD_ALIASES = {
  title: ["视频名称", "视频标题", "标题", "title", "video_title", "videoName"],
  link: ["视频链接", "视频URL", "视频地址", "TikTok链接", "link", "video_link", "videoUrl", "video_url"],
  date: ["视频发布日期", "发布日期", "日期", "date", "publish_date", "video_publish_date"],
  creator: [
    "达人用户名",
    "达人昵称",
    "达人账号",
    "达人ID",
    "达人id",
    "creator",
    "creator_id",
    "username",
    "handle",
  ],
  revenue: ["联盟带货视频 GMV", "联盟带货视频GMV", "GMV", "gmv", "revenue"],
  totalRevenue: ["GMV", "总GMV", "total_gmv"],
  orders: ["联盟订单量", "订单量", "orders", "affiliate_orders"],
  soldItems: ["联盟成交件数", "成交件数", "sold_items", "items_sold"],
  views: ["带货视频曝光次数", "曝光次数", "曝光", "views", "video_views"],
  likes: ["带货视频点赞数", "点赞数", "点赞", "likes"],
  comments: ["带货视频评论数", "评论数", "评论", "comments"],
  ctr: ["联盟点击率", "点击率", "ctr", "affiliate_ctr"],
  avgOrder: ["带货视频平均订单金额", "平均订单金额", "avg_order", "average_order_value"],
  rpm: ["带货视频千次曝光成交金额", "千次曝光成交金额", "rpm"],
  commission: ["预计佣金", "佣金", "commission"],
};

export function normalizeHeader(value) {
  return String(value ?? "").replace(/\s+/g, "").toLowerCase();
}

export function getRowValue(row, names) {
  for (const name of names) {
    const normalizedName = normalizeHeader(name);

    for (const [key, value] of Object.entries(row)) {
      if (normalizeHeader(key) === normalizedName) {
        return value;
      }
    }
  }

  return undefined;
}

export function normalizeDate(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + value * 86400000).toISOString().slice(0, 10);
  }

  const raw = String(value ?? "").trim();
  const match = raw.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);

  if (!match) {
    return "";
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function toNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const raw = String(value ?? "")
    .replace(/[$,，%\s]|MX\$/gi, "")
    .match(/-?\d+(\.\d+)?/);

  return raw ? Number(raw[0]) : 0;
}

export function extractCreator(url, fallback) {
  const match = String(url).match(/tiktok\.com\/@([^/]+)/);
  const creator = String(fallback ?? match?.[1] ?? "").trim();

  if (!creator) {
    return "@unknown";
  }

  return creator.startsWith("@") ? creator : `@${creator}`;
}

export function videoIdFromLink(link) {
  return String(link).match(/\/video\/(\d+)/)?.[1] ?? "";
}

export function isTikTokVideoLink(link) {
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
      : "数据源未提供标题细节，优先从首帧、字幕和商品露出顺序判断 Hook。";
  const sellingPoint = hasOrders
    ? `该视频已有 ${orders} 个联盟订单，GMV 为 ${gmv}，卖点需要围绕实际成交场景复盘。`
    : `该视频当前订单为 0，但曝光 ${views}，适合从高流量素材中拆解选题、节奏和人群匹配。`;
  const cta =
    ctr > 0
      ? `联盟点击率为 ${ctr}%，CTA 可重点检查是否在字幕、口播或购物车入口出现明确行动提示。`
      : "数据源未显示有效点击率，CTA 需要结合视频画面和评论区进一步确认。";

  return {
    hookType,
    hook,
    sellingPoint,
    cta,
    reusable: "数据源定位高价值视频 -> 下载原视频 -> 抽关键帧 -> 拆首 3 秒 Hook、卖点证明和下单触发点。",
  };
}

export async function loadExistingRecords(filePath) {
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

export function rowToSiteRecord(row, { sourceLabel, sourceRow }) {
  const link = String(getRowValue(row, FIELD_ALIASES.link) ?? "").trim();
  const date = normalizeDate(getRowValue(row, FIELD_ALIASES.date));
  const title = String(getRowValue(row, FIELD_ALIASES.title) ?? "").trim() || "未命名视频";
  const creator = extractCreator(link, getRowValue(row, FIELD_ALIASES.creator));
  const gmv = toNumber(getRowValue(row, FIELD_ALIASES.revenue));
  const totalGmv = toNumber(getRowValue(row, FIELD_ALIASES.totalRevenue));
  const orders = toNumber(getRowValue(row, FIELD_ALIASES.orders));
  const soldItems = toNumber(getRowValue(row, FIELD_ALIASES.soldItems));
  const views = toNumber(getRowValue(row, FIELD_ALIASES.views));
  const likes = toNumber(getRowValue(row, FIELD_ALIASES.likes));
  const comments = toNumber(getRowValue(row, FIELD_ALIASES.comments));
  const ctr = toNumber(getRowValue(row, FIELD_ALIASES.ctr));
  const avgOrder = toNumber(getRowValue(row, FIELD_ALIASES.avgOrder));
  const rpm = toNumber(getRowValue(row, FIELD_ALIASES.rpm));
  const commission = toNumber(getRowValue(row, FIELD_ALIASES.commission));
  const videoId = videoIdFromLink(link);
  const id = videoId || `${date}-${slugify(creator)}-${sourceRow}`;
  const revenue = gmv || totalGmv;

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
    revenue,
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
    breakdown: analysisFromRow({ title, creator, orders, views, ctr, gmv: revenue }),
    reasons: [
      orders > 0 ? `出单量 ${orders}，按目标规则优先进入成交榜。` : `出单量为 0，按曝光 ${views} 参与流量排序。`,
      `点赞 ${likes}、评论 ${comments}，可作为互动强弱依据。`,
      `数据来自 ${sourceLabel} 第 ${sourceRow} 行，字段含视频链接、发布日期、GMV、订单量、曝光、点击率、评论、点赞。`,
    ],
    source: {
      file: sourceLabel,
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
}

export async function buildSiteDataFromRows(rows, options = {}) {
  const {
    outputPath = "data/site-videos.json",
    sourceHeaders = [],
    sourceLabel = "Feishu sheet",
  } = options;
  const existingRecordsById = await loadExistingRecords(outputPath);
  const sourceRecords = rows
    .map((row, index) =>
      rowToSiteRecord(row, {
        sourceLabel,
        sourceRow: row.__sourceRow ?? index + 2,
      }),
    )
    .map((record) => mergeDisplayAssets(record, existingRecordsById.get(record.id)))
    .filter((record) => isTikTokVideoLink(record.link) && record.date >= SITE_DATA_START_DATE);

  const byDate = new Map();

  for (const record of sourceRecords) {
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

  return {
    generatedAt: new Date().toISOString(),
    sourceFile: sourceLabel,
    sourceHeaders,
    julyStart: SITE_DATA_START_DATE,
    count: siteRecords.length,
    records: siteRecords,
  };
}

export async function writeSiteData(outputPath, siteData) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(siteData, null, 2)}\n`);
}
