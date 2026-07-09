import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { sortRecordsForDailyRank } from "./site-data-builder.mjs";

const DEFAULT_BASE_PATH = "/app/app_179t4tka49p";
const MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;
const outDir = process.argv[2] ?? "out";
const dataPath = process.argv[3] ?? "data/site-videos.json";
const basePath = (process.env.NEXT_PUBLIC_SITE_BASE_PATH || DEFAULT_BASE_PATH).replace(/\/$/, "");
const siteData = JSON.parse(await readFile(dataPath, "utf8"));
const records = Array.isArray(siteData.records) ? siteData.records : [];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function formatMoney(value) {
  return `$${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(Number(value) || 0)}`;
}

function formatPercent(value) {
  return `${((Number(value) || 0) * 100).toFixed(2)}%`;
}

function mmddyyyy(date) {
  const [year, month, day] = String(date).split("-");
  return `${month}/${day}/${year}`;
}

function assetPath(value) {
  if (!value) {
    return "";
  }

  if (/^https?:\/\//.test(value)) {
    return value;
  }

  return value.startsWith("/") ? `${basePath}${value}` : `${basePath}/${value}`;
}

function sortRecordsForDate(items) {
  return sortRecordsForDailyRank(items);
}

function groupRecordsByDate(items) {
  const byDate = new Map();

  for (const record of items) {
    const bucket = byDate.get(record.date) ?? [];
    bucket.push(record);
    byDate.set(record.date, bucket);
  }

  return new Map(
    Array.from(byDate.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, dateRecords]) => [date, sortRecordsForDate(dateRecords)]),
  );
}

function pageHref(date, record) {
  const sortedDates = Array.from(recordsByDate.keys());
  const firstDate = sortedDates[0];
  const firstRecord = recordsByDate.get(firstDate)?.[0];

  if (date === firstDate && record?.id === firstRecord?.id) {
    return `${basePath}/`;
  }

  return `${basePath}/dates/${date}/${encodeURIComponent(record?.id ?? "top")}/`;
}

function dateHref(date) {
  const firstRecord = recordsByDate.get(date)?.[0];
  return pageHref(date, firstRecord);
}

function fallbackFrames(record) {
  if (Array.isArray(record.frames) && record.frames.length > 0) {
    return record.frames;
  }

  return [
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
  ];
}

function isPendingCover(record) {
  return record?.mediaStatus?.cover === "pending" || String(record?.cover ?? "").includes("/placeholders/");
}

function isPendingFrame(frame) {
  return String(frame?.image ?? "").includes("/placeholders/");
}

function renderDateLinks(currentDate) {
  return Array.from(recordsByDate.keys())
    .map((date) => {
      const activeClass = date === currentDate ? " date-button-active" : "";
      return `<a class="date-button${activeClass}" href="${dateHref(date)}">${escapeHtml(date)}</a>`;
    })
    .join("");
}

function renderRanking(date, selectedRecord) {
  const dateRecords = recordsByDate.get(date) ?? [];

  return dateRecords
    .slice(0, 10)
    .map((record, index) => {
      const activeClass = record.id === selectedRecord.id ? " video-row-active" : "";
      return `<a class="video-row${activeClass}" href="${pageHref(date, record)}">
        <span class="rank">Top ${index + 1}</span>
        <span class="row-main">
          <strong>${escapeHtml(record.creator)}</strong>
          <small>${escapeHtml(record.title || record.product || record.link)}</small>
        </span>
        <span class="row-metric">${
          Number(record.orders) > 0
            ? `${formatNumber(record.orders)} 单`
            : `${formatNumber(record.views)} 播放`
        }</span>
        <span class="row-preview" aria-hidden="true">
          ${
            isPendingCover(record)
              ? `<span class="row-preview-placeholder">待下载</span>`
              : `<img alt="" class="row-preview-image" src="${assetPath(record.cover)}"/>`
          }
        </span>
      </a>`;
    })
    .join("");
}

function renderMetrics(record) {
  return [
    ["hot", `曝光 ${formatNumber(record.views)}`, "带货视频曝光次数"],
    ["hot", `点赞 ${formatNumber(record.likes)}`, "带货视频点赞数"],
    ["hot", `评论 ${formatNumber(record.comments)}`, "带货视频评论数"],
    ["hot", `联盟订单 ${formatNumber(record.orders)}`, "联盟订单量"],
    ["hot", `GMV ${formatMoney(record.revenue)}`, "GMV"],
    ["soft", `点击率 ${formatPercent(record.ctr)}`, "联盟点击率"],
    ["soft", `客单 ${formatMoney(record.price)}`, "客单价"],
    ["soft", record.audience || "Mexico / Spanish", "人群"],
    ["soft", record.language || "Spanish", "语言"],
    ["soft", record.category || "TikTok Shop Mexico", "分类"],
  ]
    .map(([className, text, title]) => `<span class="${className}" title="${escapeHtml(title)}">${escapeHtml(text)}</span>`)
    .join("");
}

function renderFrames(record) {
  return fallbackFrames(record)
    .slice(0, 5)
    .map(
      (frame) => `<article class="frame-card">
        <div class="frame-image-wrap">${
          isPendingFrame(frame)
            ? `<div class="frame-placeholder"><strong>待抽取</strong><span>${escapeHtml(frame.time)}</span></div>`
            : `<img class="frame-image" alt="${escapeHtml(`${frame.time} ${frame.title}`)}" src="${assetPath(frame.image)}"/>`
        }</div>
        <strong>${escapeHtml(frame.time)}</strong>
        <h4>${escapeHtml(frame.title)}</h4>
        <p>${escapeHtml(frame.note)}</p>
      </article>`,
    )
    .join("");
}

function renderScript(record) {
  const script = Array.isArray(record.script) && record.script.length > 0
    ? record.script
    : [
        {
          time: "00:00",
          english: "Awaiting downloaded video transcript",
          chinese: "等待下载视频后补充真实脚本逐句拆解",
        },
      ];

  return script
    .map(
      (line) => `<div class="script-row">
        <span>${escapeHtml(line.time)}</span>
        <span>${escapeHtml(line.english)}</span>
        <span>${escapeHtml(line.chinese)}</span>
      </div>`,
    )
    .join("");
}

function renderBreakdown(record) {
  const breakdown = record.breakdown ?? {};
  const rows = [
    ["Hook 类型", breakdown.hookType || "流量观察型"],
    [
      "Hook 拆解",
      breakdown.hook ||
        `标题围绕“${record.title || record.product || record.creator}”展开，适合优先观察首屏是否直接露出痛点、商品或结果。`,
    ],
    [
      "卖点呈现",
      breakdown.sellingPoint ||
        `该视频当前订单为 ${formatNumber(record.orders)}，曝光 ${formatNumber(record.views)}，适合从高流量素材中拆解选题、节奏和人群匹配。`,
    ],
    ["CTA", breakdown.cta || "数据源未显示有效点击率，CTA 需要结合视频画面和评论区进一步确认。"],
    [
      "可复用套路",
      breakdown.reusable ||
        "数据源定位高价值视频 -> 下载原视频 -> 抽关键帧 -> 拆首 3 秒 Hook、卖点证明和下单触发点。",
    ],
  ];

  return rows
    .map(([label, text]) => `<div><strong>${escapeHtml(label)}</strong><p>${escapeHtml(text)}</p></div>`)
    .join("");
}

function renderReasons(record) {
  const reasons = Array.isArray(record.reasons) && record.reasons.length > 0
    ? record.reasons
    : [
        `出单量为 ${formatNumber(record.orders)}，当天有成单时按成单从大到小排序；无成单时按播放从高到低排序。`,
        `点赞 ${formatNumber(record.likes)}、评论 ${formatNumber(record.comments)}，可作为互动强弱依据。`,
        `数据来自 ${record.source?.file || siteData.sourceFile || "Feishu:TikTok每日视频数据"}，字段含视频链接、发布日期、GMV、订单量、曝光、点击率、评论、点赞。`,
      ];

  return reasons
    .slice(0, 4)
    .map(
      (reason, index) => `<div class="reason-item">
        <strong>${index + 1}</strong>
        <p>${escapeHtml(reason)}</p>
      </div>`,
    )
    .join("");
}

function renderPage(date, selectedRecord, css) {
  const dateRecords = recordsByDate.get(date) ?? [];
  const rank = Math.max(
    1,
    dateRecords.findIndex((record) => record.id === selectedRecord.id) + 1,
  );
  const source = selectedRecord.source ?? {};
  const sourceFile = source.file || siteData.sourceFile || "Feishu:TikTok每日视频数据";
  const sourceRow = source.row ? ` 第 ${source.row} 行` : "";
  const mediaPending = !selectedRecord.mediaStatus?.keyframes;
  const dateHasOrders = dateRecords.some((record) => Number(record.orders) > 0);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>TikTok 每日视频分析台</title>
  <style>${css}</style>
  <style>
    .date-links { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
    .video-row { text-decoration:none; }
    .static-note { color:#667085; font-size:12px; font-weight:800; margin-top:8px; }
  </style>
</head>
<body>
  <main class="min-h-screen bg-[#f3f3f4] text-[#1f2933]">
    <section class="toolbar-shell">
      <div class="site-heading">
        <span>HALOVIDA Mexico</span>
        <h1>TikTok 每日爆款视频拆解</h1>
      </div>
      <div class="filter-bar clean-filter">
        <div class="week-pill"><span class="calendar-mark">▣</span>2026 第 28 周</div>
        <div class="calendar-select"><span>选择日期</span><strong>${escapeHtml(mmddyyyy(date))}</strong></div>
        <div class="calendar-select"><span>日期拉表</span><strong>${escapeHtml(date)}</strong></div>
      </div>
      <div class="date-links">${renderDateLinks(date)}</div>
    </section>

    <section class="mx-auto grid max-w-[1560px] gap-5 px-5 py-5 lg:grid-cols-[360px_minmax(0,1fr)] lg:px-8">
      <aside class="flex flex-col gap-4">
        <div class="panel">
          <div class="section-title with-action">
            <div><span></span><h2>每日榜单</h2></div>
            <small>${dateHasOrders ? "按成单从大到小" : "无成单，按播放从高到低"}</small>
          </div>
          <div class="ranking-summary">${escapeHtml(date)} · Top 1-${Math.min(10, dateRecords.length)}</div>
          <div class="video-list">${renderRanking(date, selectedRecord)}</div>
          <p class="static-note">飞书妙搭稳定版：点击榜单或日期会打开对应静态页面。</p>
        </div>
      </aside>

      <div class="flex min-w-0 flex-col gap-5">
        <section class="panel video-detail">
          <div class="video-stage">
            <div class="phone-frame">
              ${
                isPendingCover(selectedRecord)
                  ? `<div class="phone-placeholder"><strong>视频素材待下载</strong><span>不会展示其他视频画面</span><small>下载该 TikTok 视频后自动补封面、关键帧和脚本</small></div>`
                  : `<img class="phone-image" alt="${escapeHtml(`${selectedRecord.title} 视频封面`)}" src="${assetPath(selectedRecord.cover)}"/>`
              }
              <div class="play-layer"><span>${selectedRecord.videoReady ? "GIF 预览" : "素材待处理"}</span></div>
            </div>
            <p class="video-hint">${selectedRecord.videoReady ? "视频已下载到站点，可直接预览" : "暂未下载到本地，不展示其他视频画面；点击链接可查看原 TikTok 视频"}</p>
          </div>
          <div class="detail-content">
            <div class="detail-heading">
              <div><p class="eyebrow">Top ${rank} · ${escapeHtml(selectedRecord.creator)}</p></div>
              <a class="link-button" href="${escapeHtml(selectedRecord.link)}" rel="noreferrer" target="_blank">打开链接</a>
            </div>
            <div class="metric-strip">${renderMetrics(selectedRecord)}</div>
            <div class="source-note">
              <strong>数据依据</strong>
              <span>${escapeHtml(sourceFile)}${escapeHtml(sourceRow)}：视频名称 / 视频链接 / 视频发布日期 / 达人用户名 / GMV / 联盟订单量 / 带货视频曝光次数 / 联盟点击率 / 带货视频点赞数 / 带货视频评论数</span>
            </div>
            <div class="section-title mt-5"><span></span><h3>关键画面截图与脚本分析</h3></div>
            ${mediaPending ? `<p class="media-status-note">该视频还没有对应关键帧，以下是待处理状态；不会复用其他视频截图。</p>` : ""}
            <div class="frames-grid">${renderFrames(selectedRecord)}</div>
          </div>
        </section>

        <section class="analysis-grid">
          <article class="panel">
            <div class="section-title with-action"><div><span></span><h3>完整脚本</h3></div></div>
            <div class="script-table">
              <div class="script-row script-head"><span>时间</span><span>原文/口播</span><span>中文</span></div>
              ${renderScript(selectedRecord)}
            </div>
          </article>
          <article class="panel">
            <div class="section-title"><span></span><h3>拆解</h3></div>
            <div class="breakdown-table">${renderBreakdown(selectedRecord)}</div>
          </article>
          <article class="panel">
            <div class="section-title"><span></span><h3>爆款原因</h3></div>
            <div class="reason-list">${renderReasons(selectedRecord)}</div>
          </article>
        </section>
      </div>
    </section>
  </main>
</body>
</html>`;
}

async function walkFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

async function getDirectorySize(directory) {
  const files = await walkFiles(directory);
  let total = 0;

  for (const file of files) {
    total += (await stat(file)).size;
  }

  return total;
}

async function writePage(relativePath, html) {
  const pagePath = path.join(outDir, relativePath);
  await mkdir(path.dirname(pagePath), { recursive: true });
  await writeFile(pagePath, html);
}

const recordsByDate = groupRecordsByDate(records);
const cssFiles = (await walkFiles(path.join(outDir, "_next", "static", "css"))).filter((file) => file.endsWith(".css"));
const css = `${await Promise.all(cssFiles.map((file) => readFile(file, "utf8"))).then((parts) => parts.join("\n"))}`;

await rm(path.join(outDir, "_next"), { recursive: true, force: true });
await rm(path.join(outDir, "_not-found"), { recursive: true, force: true });
await rm(path.join(outDir, "404"), { recursive: true, force: true });
await rm(path.join(outDir, "404.html"), { force: true });
await rm(path.join(outDir, "assets"), { recursive: true, force: true });

let pageCount = 0;

for (const [date, dateRecords] of recordsByDate.entries()) {
  const firstRecord = dateRecords[0];

  if (!firstRecord) {
    continue;
  }

  await writePage(`dates/${date}/index.html`, renderPage(date, firstRecord, css));
  pageCount += 1;

  for (const record of dateRecords.slice(0, 10)) {
    await writePage(`dates/${date}/${encodeURIComponent(record.id)}/index.html`, renderPage(date, record, css));
    pageCount += 1;
  }
}

const latestDate = Array.from(recordsByDate.keys())[0];
const latestRecord = recordsByDate.get(latestDate)?.[0];

if (latestDate && latestRecord) {
  await writePage("index.html", renderPage(latestDate, latestRecord, css));
  pageCount += 1;
}

const totalBytes = await getDirectorySize(outDir);

if (totalBytes > MAX_UNCOMPRESSED_BYTES) {
  throw new Error(`Miaoda publish directory is ${totalBytes} bytes, over the ${MAX_UNCOMPRESSED_BYTES} byte limit.`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      outDir,
      pageCount,
      totalMB: Number((totalBytes / 1024 / 1024).toFixed(2)),
      latestDate,
      latestRecord: latestRecord?.id,
      mode: "static-no-js",
    },
    null,
    2,
  ),
);
