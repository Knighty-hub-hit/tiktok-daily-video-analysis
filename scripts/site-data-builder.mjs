import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const SITE_DATA_START_DATE = process.env.SITE_DATA_START_DATE ?? "2026-07-01";
export const MAX_PER_DATE = Number.parseInt(process.env.SITE_DATA_MAX_PER_DATE ?? "100", 10);
export const PENDING_COVER = "/placeholders/video-pending.svg";
export const PENDING_FRAME = "/placeholders/frame-pending.svg";

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

export function compareRecordsForDailyRank(a, b, hasOrders) {
  const orderDelta = (Number(b.orders) || 0) - (Number(a.orders) || 0);
  const viewDelta = (Number(b.views) || 0) - (Number(a.views) || 0);
  const likeDelta = (Number(b.likes) || 0) - (Number(a.likes) || 0);

  if (hasOrders && orderDelta !== 0) {
    return orderDelta;
  }

  return viewDelta || likeDelta;
}

export function sortRecordsForDailyRank(records) {
  const hasOrders = records.some((record) => (Number(record.orders) || 0) > 0);
  return [...records].sort((a, b) => compareRecordsForDailyRank(a, b, hasOrders));
}

function publicAssetPath(assetPath) {
  if (!assetPath || !String(assetPath).startsWith("/")) {
    return "";
  }

  return path.join("public", String(assetPath).slice(1));
}

async function publicAssetExists(assetPath) {
  const localPath = publicAssetPath(assetPath);

  if (!localPath) {
    return false;
  }

  try {
    await access(localPath);
    return true;
  } catch {
    return false;
  }
}

async function firstExistingAsset(paths) {
  for (const assetPath of paths) {
    if (await publicAssetExists(assetPath)) {
      return assetPath;
    }
  }

  return "";
}

function isGenericCover(assetPath) {
  return !assetPath || ["/video-cover.png", PENDING_COVER].includes(String(assetPath));
}

function isGenericFrame(assetPath) {
  return !assetPath || String(assetPath).startsWith("/frames/") || String(assetPath) === PENDING_FRAME;
}

function isPendingScript(script) {
  if (!Array.isArray(script) || script.length === 0) {
    return true;
  }

  return script.every((line) => {
    const english = String(line?.english ?? "");
    const chinese = String(line?.chinese ?? "");
    return english.includes("Awaiting downloaded video transcript") || chinese.includes("等待下载视频");
  });
}

function pendingFrames() {
  return [
    {
      time: "00:00",
      title: "素材待下载",
      note: "当前还没有拿到这条视频的真实首帧，不展示其他视频画面，避免错配。",
      image: PENDING_FRAME,
    },
    {
      time: "00:03",
      title: "关键帧待抽取",
      note: "视频下载后会用同一视频 ID 的关键帧替换，用于判断卖点、商品露出和节奏。",
      image: PENDING_FRAME,
    },
    {
      time: "00:06",
      title: "脚本待拆解",
      note: "拿到字幕或视频后再补充真实口播、字幕和 CTA 拆解。",
      image: PENDING_FRAME,
    },
  ];
}

function pendingScript() {
  return [
    {
      time: "待处理",
      english: "Video transcript is not available yet",
      chinese: "该视频暂未下载字幕/音频，等待素材处理后补充真实脚本",
    },
  ];
}

function cueTimestampToSeconds(value) {
  const parts = String(value).replace(",", ".").split(":").map(Number);

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  return Number(parts[0]) || 0;
}

function formatCueTime(seconds) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const second = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
}

function parseVttTranscript(text) {
  const cues = [];
  const blocks = String(text)
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  for (const block of blocks) {
    if (block === "WEBVTT" || block.startsWith("NOTE")) {
      continue;
    }

    const lines = block.split("\n").filter(Boolean);
    const timeLineIndex = lines.findIndex((line) => line.includes("-->"));

    if (timeLineIndex < 0) {
      continue;
    }

    const [start] = lines[timeLineIndex].split("-->");
    const textLines = lines
      .slice(timeLineIndex + 1)
      .map((line) => line.replace(/<[^>]+>/g, "").trim())
      .filter(Boolean);
    const cueText = textLines.join(" ").replace(/\s+/g, " ").trim();

    if (!cueText) {
      continue;
    }

    cues.push({
      time: formatCueTime(cueTimestampToSeconds(start.trim())),
      english: cueText,
      chinese: "待翻译 / 待二次拆解",
    });
  }

  return cues.slice(0, 40);
}

async function parseTranscriptFile(assetPath) {
  const localPath = publicAssetPath(assetPath);

  if (!localPath) {
    return [];
  }

  try {
    return parseVttTranscript(await readFile(localPath, "utf8"));
  } catch {
    return [];
  }
}

export async function attachLocalMediaAssets(record) {
  const id = record.id;
  const coverFromExisting =
    !isGenericCover(record.cover) && (await publicAssetExists(record.cover)) ? record.cover : "";
  const coverFromFile = await firstExistingAsset([
    `/covers/${id}.png`,
    `/covers/${id}.jpg`,
    `/covers/${id}.jpeg`,
    `/covers/${id}.webp`,
  ]);
  const videoGif = await firstExistingAsset([`/videos/${id}.gif`]);
  const videoMp4 = await firstExistingAsset([`/videos/${id}.mp4`]);
  const transcriptFile = await firstExistingAsset([`/videos/${id}.vtt`]);
  const frameSpecs = [
    ["00:00", "首帧画面", "来自该视频的首帧截图，用于判断开场是否直接露出人、商品或痛点。", `/keyframes/${id}-00.png`],
    ["00:03", "3 秒画面", "来自该视频第 3 秒附近的截图，用于观察卖点展开和商品呈现。", `/keyframes/${id}-03.png`],
    ["00:06", "6 秒画面", "来自该视频第 6 秒附近的截图，用于观察 CTA、证明点或节奏变化。", `/keyframes/${id}-06.png`],
  ];
  const realFrames = [];

  for (const [time, title, note, image] of frameSpecs) {
    if (await publicAssetExists(image)) {
      realFrames.push({ time, title, note, image });
    }
  }

  const curatedFrames =
    Array.isArray(record.frames) &&
    record.frames.length > 0 &&
    record.frames.some((frame) => !isGenericFrame(frame?.image))
      ? record.frames
      : [];
  const parsedScript = transcriptFile ? await parseTranscriptFile(transcriptFile) : [];
  const curatedScript = !isPendingScript(record.script) ? record.script : [];
  const videoFile = videoGif || videoMp4 || "";
  const cover = coverFromExisting || coverFromFile || realFrames[0]?.image || PENDING_COVER;

  return {
    ...record,
    cover,
    ...(videoFile
      ? {
          videoFile,
          videoReady: true,
          mediaType: videoGif ? "gif" : "video",
        }
      : {
          videoFile: undefined,
          videoReady: false,
          mediaType: undefined,
        }),
    transcriptFile: transcriptFile || undefined,
    frames: realFrames.length > 0 ? realFrames : curatedFrames.length > 0 ? curatedFrames : pendingFrames(),
    script: parsedScript.length > 0 ? parsedScript : curatedScript.length > 0 ? curatedScript : pendingScript(),
    mediaStatus: {
      cover: cover === PENDING_COVER ? "pending" : "matched",
      video: videoFile ? "matched" : "pending",
      keyframes: realFrames.length,
      transcript: parsedScript.length > 0 ? "matched" : "pending",
    },
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
    cover: !isGenericCover(existingRecord.cover) ? existingRecord.cover : record.cover,
    videoFile: existingRecord.videoReady ? existingRecord.videoFile : record.videoFile,
    videoReady: existingRecord.videoReady ?? record.videoReady,
    mediaType: existingRecord.videoReady ? existingRecord.mediaType : record.mediaType,
    transcriptFile: existingRecord.transcriptFile ?? record.transcriptFile,
    frames: existingRecord.frames?.some((frame) => !isGenericFrame(frame?.image)) ? existingRecord.frames : record.frames,
    script: !isPendingScript(existingRecord.script) ? existingRecord.script : record.script,
    breakdown: record.breakdown,
    reasons: record.reasons,
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
    cover: PENDING_COVER,
    videoReady: false,
    frames: pendingFrames(),
    script: pendingScript(),
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
  const sourceRecords = (
    await Promise.all(
      rows.map(async (row, index) => {
        const record = rowToSiteRecord(row, {
          sourceLabel,
          sourceRow: row.__sourceRow ?? index + 2,
        });

        return attachLocalMediaAssets(mergeDisplayAssets(record, existingRecordsById.get(record.id)));
      }),
    )
  ).filter((record) => isTikTokVideoLink(record.link) && record.date >= SITE_DATA_START_DATE);

  const byDate = new Map();

  for (const record of sourceRecords) {
    const current = byDate.get(record.date) ?? [];
    current.push(record);
    byDate.set(record.date, current);
  }

  const siteRecords = Array.from(byDate.entries())
    .flatMap(([, dateRecords]) => sortRecordsForDailyRank(dateRecords).slice(0, MAX_PER_DATE))
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
