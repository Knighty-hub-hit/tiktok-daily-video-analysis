"use client";

import { ChangeEvent, useMemo, useState } from "react";
import Image from "next/image";

type Frame = {
  time: string;
  title: string;
  note: string;
  image: string;
};

type ScriptLine = {
  time: string;
  english: string;
  chinese: string;
};

type Breakdown = {
  hookType: string;
  hook: string;
  sellingPoint: string;
  cta: string;
  reusable: string;
};

type VideoRecord = {
  id: string;
  date: string;
  creator: string;
  title: string;
  product: string;
  category: string;
  audience: string;
  language: string;
  link: string;
  views: number;
  likes: number;
  orders: number;
  revenue: number;
  price: number;
  cover: string;
  frames: Frame[];
  script: ScriptLine[];
  breakdown: Breakdown;
  reasons: string[];
};

const sampleFrames: Frame[] = [
  {
    time: "00:00",
    title: "痛点开场",
    note: "侧面脸部特写先放大双下巴和颈部线条问题，字幕直接抛出用户的外貌焦虑。",
    image: "/frames/frame-00.png",
  },
  {
    time: "00:01",
    title: "悬念转折",
    note: "用“what FINALLY fixed it”制造解决方案悬念，让观众愿意继续看产品出现。",
    image: "/frames/frame-01.png",
  },
  {
    time: "00:02",
    title: "产品露出",
    note: "三支粉色产品整齐摆放，包装和品名清晰可见，迅速建立商品记忆点。",
    image: "/frames/frame-02.png",
  },
  {
    time: "00:03",
    title: "手持展示",
    note: "手持产品展示大小、质感和包装细节，降低陌生商品的理解成本。",
    image: "/frames/frame-03.png",
  },
  {
    time: "00:06",
    title: "功能演示",
    note: "近距离展示金属刮痧头，明确说明产品独特结构和使用方式。",
    image: "/frames/frame-06.png",
  },
];

const seedVideos: VideoRecord[] = [
  {
    id: "medicube-neck-cream",
    date: "2026-07-06",
    creator: "@myttsfindsss",
    title:
      "[NEW] medicube PDRN Collagen Gua Sha Neck Wrinkle Cream | Built-In Gua Sha Massager",
    product: "PDRN Collagen Gua Sha Neck Wrinkle Cream",
    category: "美妆个护",
    audience: "白人英语",
    language: "英语",
    link: "https://www.tiktok.com/@myttsfindsss/video/7656938859250437407",
    views: 4784882,
    likes: 46755,
    orders: 2364,
    revenue: 63828,
    price: 27,
    cover: "/video-cover.png",
    frames: sampleFrames,
    script: [
      {
        time: "00:00",
        english: "my biggest insecurity...",
        chinese: "我最大的不安全感...",
      },
      {
        time: "00:01",
        english: "what FINALLY fixed it",
        chinese: "最终解决了它的方法",
      },
      {
        time: "00:02",
        english: "start here for your jawline",
        chinese: "想改善下颌线，从这里开始",
      },
    ],
    breakdown: {
      hookType: "痛点展示型",
      hook:
        "开场直接展示双下巴和颈部线条问题，配合“my biggest insecurity...”字幕，迅速触发同类用户的情绪共鸣。",
      sellingPoint:
        "卖点集中在内置刮痧按摩头、颈霜涂抹方式和紧致暗示，产品创新点通过实物近景和真人演示完成说明。",
      cta:
        "文案用产品名、功能词和 TikTok Shop 标签承接搜索流量，并用明确的行动句引导下单。",
      reusable:
        "痛点特写 + 悬念字幕 + 产品露出 + 使用演示 + 效果暗示，适合美妆、个护和家用小工具复用。",
    },
    reasons: [
      "开头不讲产品，先讲用户在意的外貌问题，停留率更容易被拉高。",
      "产品颜色、形状和金属按摩头有辨识度，画面不需要复杂布景也能成立。",
      "脚本短、节奏快，每个镜头都承担一个转化任务，减少无效信息。",
      "TikTok Shop 标签、创作者推荐语和价格带形成了即时购买理由。",
    ],
  },
  {
    id: "clean-balm-demo",
    date: "2026-07-06",
    creator: "@dailyglowfinds",
    title: "Melting balm that removes waterproof makeup in one swipe",
    product: "Zero Rub Cleansing Balm",
    category: "美妆个护",
    audience: "年轻女性",
    language: "英语",
    link: "https://www.tiktok.com/@dailyglowfinds/video/7656000000000000001",
    views: 1298800,
    likes: 18420,
    orders: 642,
    revenue: 17334,
    price: 27,
    cover: "/video-cover.png",
    frames: sampleFrames.slice(0, 4),
    script: [
      {
        time: "00:00",
        english: "I stopped scrubbing my skin raw",
        chinese: "我终于不用把皮肤搓到泛红了",
      },
      {
        time: "00:02",
        english: "this melts everything in one swipe",
        chinese: "它一下就能融掉彩妆",
      },
    ],
    breakdown: {
      hookType: "错误纠正型",
      hook: "用“不要再粗暴卸妆”的反向提醒切入，抓住护肤人群对屏障受损的担心。",
      sellingPoint: "用手背测试、防水彩妆溶解和清水乳化三个动作证明清洁力。",
      cta: "以低门槛价格和套装优惠引导收藏、搜索和下单。",
      reusable: "错误行为提醒 + 快速测试 + 前后对比 + 低价 CTA。",
    },
    reasons: [
      "测试动作非常直观，观众无需理解复杂成分也能看懂效果。",
      "对“屏障受损”的担心是强痛点，容易带来评论互动。",
      "价格和使用频率匹配，转化门槛低。",
    ],
  },
  {
    id: "mini-printer",
    date: "2026-07-05",
    creator: "@deskupgrade",
    title: "Tiny label printer that makes every storage box look organized",
    product: "Mini Thermal Label Printer",
    category: "家居收纳",
    audience: "英语家庭用户",
    language: "英语",
    link: "https://www.tiktok.com/@deskupgrade/video/7655000000000000002",
    views: 842300,
    likes: 15340,
    orders: 0,
    revenue: 0,
    price: 19.99,
    cover: "/video-cover.png",
    frames: sampleFrames.slice(1, 5),
    script: [
      {
        time: "00:00",
        english: "labeling everything changed my kitchen",
        chinese: "给所有东西贴标签后，我的厨房变了",
      },
      {
        time: "00:04",
        english: "no ink, no mess, just peel and stick",
        chinese: "不用墨水，不脏乱，撕下就能贴",
      },
    ],
    breakdown: {
      hookType: "结果展示型",
      hook: "先展示整齐收纳后的结果，再倒推小工具的作用。",
      sellingPoint: "卖点围绕免墨水、便携、贴纸耐用和收纳场景展开。",
      cta: "用“kitchen reset”和“under $20”触发冲动购买。",
      reusable: "最终效果 + 小工具出场 + 场景连续展示 + 价格刺激。",
    },
    reasons: [
      "收纳前后差异天然适合短视频，画面满足感强。",
      "即使没有出单，也有不错流量，适合二次测试价格和首句脚本。",
      "家庭、办公室、学生宿舍都可扩展，素材复用空间大。",
    ],
  },
  {
    id: "shoe-cleaner",
    date: "2026-07-05",
    creator: "@cleanfixlab",
    title: "White sneakers restored in 20 seconds with this foam kit",
    product: "Instant Sneaker Foam Cleaner",
    category: "清洁护理",
    audience: "运动鞋用户",
    language: "英语",
    link: "https://www.tiktok.com/@cleanfixlab/video/7655000000000000003",
    views: 536900,
    likes: 9100,
    orders: 0,
    revenue: 0,
    price: 14.99,
    cover: "/video-cover.png",
    frames: sampleFrames.slice(0, 4),
    script: [
      {
        time: "00:00",
        english: "these were supposed to be white",
        chinese: "这双鞋本来应该是白色的",
      },
      {
        time: "00:03",
        english: "watch the foam lift the stains",
        chinese: "看泡沫把污渍带起来",
      },
    ],
    breakdown: {
      hookType: "反差对比型",
      hook: "用脏鞋近景制造视觉冲击，第一秒就能看出问题。",
      sellingPoint: "泡沫清洁过程可视化，刷洗动作简单，适合快节奏演示。",
      cta: "用“save your sneakers”强调省钱和即时修复。",
      reusable: "脏污近景 + 清洁过程 + 半边对比 + 完整结果。",
    },
    reasons: [
      "强对比画面适合无声播放，流量排序中优先级高。",
      "产品单价低，适合用优惠券和多件装测试转化。",
      "脚本可拆成多条不同污渍场景继续投放。",
    ],
  },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatMoney(value: number) {
  return `$${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function parseNumber(value: string | undefined) {
  const normalized = String(value ?? "")
    .replace(/[$,，\s]/g, "")
    .match(/-?\d+(\.\d+)?/);

  return normalized ? Number(normalized[0]) : 0;
}

function normalizeDate(value: string | undefined, fallback: string) {
  const raw = String(value ?? "").trim();
  const isoMatch = raw.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);

  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const usMatch = raw.match(/(\d{1,2})\/(\d{1,2})\/(20\d{2})/);

  if (usMatch) {
    const [, month, day, year] = usMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return fallback;
}

function extractUrls(text: string) {
  return Array.from(
    new Set(
      (text.match(/https?:\/\/[^\s,，;；]+/g) ?? [])
        .map((url) => url.replace(/[)\].。]+$/, ""))
        .filter((url) => url.includes("tiktok.com")),
    ),
  );
}

function parseDelimitedLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseDelimitedRows(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  return lines.map((line) => parseDelimitedLine(line, delimiter));
}

function getCell(row: string[], headers: string[], candidates: string[]) {
  const normalizedHeaders = headers.map((header) =>
    header.replace(/\s+/g, "").toLowerCase(),
  );
  const normalizedCandidates = candidates.map((candidate) =>
    candidate.replace(/\s+/g, "").toLowerCase(),
  );
  const index = normalizedHeaders.findIndex((header) =>
    normalizedCandidates.some((candidate) => header.includes(candidate)),
  );

  return index >= 0 ? row[index] : undefined;
}

function buildImportedRecord(
  url: string,
  date: string,
  index: number,
  overrides: Partial<VideoRecord> = {},
): VideoRecord {
  const creatorMatch = url.match(/tiktok\.com\/@([^/]+)/);
  const creator = creatorMatch ? `@${creatorMatch[1]}` : "@待识别达人";

  const record: VideoRecord = {
    id: `imported-${date}-${index}-${Date.now()}`,
    date,
    creator,
    title: "导入视频，等待补充商品和脚本分析",
    product: "待分析商品",
    category: "待归类",
    audience: "待识别",
    language: "待识别",
    link: url,
    views: 0,
    likes: 0,
    orders: 0,
    revenue: 0,
    price: 0,
    cover: "/video-cover.png",
    frames: sampleFrames.slice(0, 3),
    script: [
      {
        time: "00:00",
        english: "Imported from daily TikTok export",
        chinese: "已从每日导出链接导入，等待生成脚本",
      },
    ],
    breakdown: {
      hookType: "待识别",
      hook: "导入后可继续补充首帧、字幕和达人信息，生成 Hook 拆解。",
      sellingPoint: "等待从视频画面、标题、商品词和评论中抽取卖点。",
      cta: "等待识别链接中的购物意图、标签和行动号召。",
      reusable: "导入链接 -> 抓取视频信息 -> 生成关键帧 -> 输出复用脚本。",
    },
    reasons: ["该视频还没有订单和流量数据，当前排在同日榜单后方。"],
  };

  return {
    ...record,
    ...overrides,
    creator: overrides.creator ?? record.creator,
  };
}

function parseExportRecords(text: string, fallbackDate: string) {
  const tableRows = parseDelimitedRows(text);

  if (tableRows.length > 1) {
    const headers = tableRows[0];
    const parsedRecords = tableRows
      .slice(1)
      .map((row, index) => {
        const linkCell =
          getCell(row, headers, ["视频链接", "链接", "video link", "url"]) ?? "";
        const link = extractUrls(linkCell)[0];

        if (!link) {
          return null;
        }

        const date = normalizeDate(
          getCell(row, headers, ["视频发布日期", "发布日期", "日期", "入库日期"]),
          fallbackDate,
        );
        const creator =
          getCell(row, headers, ["达人用户名", "达人", "creator", "username"]) ??
          undefined;
        const title =
          getCell(row, headers, ["视频标题", "标题", "title"]) ??
          "导入视频，等待生成脚本分析";
        const product =
          getCell(row, headers, ["商品名称", "产品名称", "商品", "product"]) ??
          "待分析商品";

        return buildImportedRecord(link, date, index, {
          creator: creator || undefined,
          title,
          product,
          category:
            getCell(row, headers, ["类目", "分类", "category"]) ?? "待归类",
          audience:
            getCell(row, headers, ["人群", "用户画像", "audience"]) ?? "待识别",
          language: getCell(row, headers, ["语言", "language"]) ?? "待识别",
          views: parseNumber(
            getCell(row, headers, ["播放量", "播放", "views", "vv"]),
          ),
          likes: parseNumber(getCell(row, headers, ["点赞量", "点赞", "likes"])),
          orders: parseNumber(
            getCell(row, headers, ["出单量", "销量", "订单", "orders"]),
          ),
          revenue: parseNumber(
            getCell(row, headers, ["销售额", "gmv", "revenue"]),
          ),
          price: parseNumber(getCell(row, headers, ["标价", "价格", "price"])),
        });
      })
      .filter((record): record is VideoRecord => Boolean(record));

    if (parsedRecords.length > 0) {
      return parsedRecords;
    }
  }

  return extractUrls(text).map((url, index) =>
    buildImportedRecord(url, fallbackDate, index),
  );
}

export default function Home() {
  const [selectedDate, setSelectedDate] = useState("2026-07-06");
  const [activeVideoId, setActiveVideoId] = useState(seedVideos[0].id);
  const [customVideos, setCustomVideos] = useState<VideoRecord[]>([]);
  const [importDate, setImportDate] = useState("2026-07-07");
  const [pasteText, setPasteText] = useState("");

  const allVideos = useMemo(
    () => [...customVideos, ...seedVideos],
    [customVideos],
  );

  const dates = useMemo(
    () =>
      Array.from(new Set(allVideos.map((video) => video.date))).sort((a, b) =>
        b.localeCompare(a),
      ),
    [allVideos],
  );

  const visibleVideos = useMemo(() => {
    const filtered = allVideos.filter((video) => video.date === selectedDate);
    const hasOrders = filtered.some((video) => video.orders > 0);

    return [...filtered].sort((a, b) => {
      if (hasOrders) {
        return b.orders - a.orders || b.views - a.views || b.likes - a.likes;
      }

      return b.views - a.views || b.likes - a.likes;
    });
  }, [allVideos, selectedDate]);

  const activeVideo =
    visibleVideos.find((video) => video.id === activeVideoId) ??
    visibleVideos[0] ??
    allVideos[0];
  const activeRank =
    visibleVideos.findIndex((video) => video.id === activeVideo.id) + 1 || 1;

  const sortLabel = visibleVideos.some((video) => video.orders > 0)
    ? "出单量从大到小"
    : "无出单，按流量从好到坏";

  const dailyTotals = visibleVideos.reduce(
    (totals, video) => ({
      views: totals.views + video.views,
      orders: totals.orders + video.orders,
      revenue: totals.revenue + video.revenue,
    }),
    { views: 0, orders: 0, revenue: 0 },
  );

  function importLinks() {
    const imported = parseExportRecords(pasteText, importDate);

    if (imported.length === 0) {
      return;
    }

    const latestImportedDate = imported.reduce(
      (latestDate, video) => (video.date > latestDate ? video.date : latestDate),
      imported[0].date,
    );

    setCustomVideos((current) => [...imported, ...current]);
    setSelectedDate(latestImportedDate);
    setActiveVideoId(imported[0].id);
    setPasteText("");
  }

  function handleFileLoad(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPasteText(String(reader.result ?? ""));
    };
    reader.readAsText(file);
  }

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-[#1f2933]">
      <section className="border-b border-[#e5e9f0] bg-white">
        <div className="mx-auto flex max-w-[1560px] flex-col gap-5 px-5 py-5 lg:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#cf1d61]">
                TikTok 每日视频分析台
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-normal text-[#17202a] sm:text-4xl">
                导出视频入库后的爆款拆解和排序
              </h1>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="summary-tile">
                <span>当日视频</span>
                <strong>{visibleVideos.length}</strong>
              </div>
              <div className="summary-tile">
                <span>当日出单</span>
                <strong>{formatNumber(dailyTotals.orders)}</strong>
              </div>
              <div className="summary-tile">
                <span>销售额</span>
                <strong>{formatMoney(dailyTotals.revenue)}</strong>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {dates.map((date) => (
                <button
                  className={`date-button ${
                    selectedDate === date ? "date-button-active" : ""
                  }`}
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  type="button"
                >
                  {date}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-md bg-[#fff0f4] px-3 py-2 font-semibold text-[#c61b5a]">
                排序：{sortLabel}
              </span>
              <span className="rounded-md bg-[#edf4ff] px-3 py-2 font-semibold text-[#2258c7]">
                时间观察：按发布日期切换
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1560px] gap-5 px-5 py-5 lg:grid-cols-[360px_minmax(0,1fr)] lg:px-8">
        <aside className="flex flex-col gap-4">
          <div className="panel">
            <div className="section-title">
              <span />
              <h2>每日导出入口</h2>
            </div>
            <label className="field-label" htmlFor="import-date">
              入库日期
            </label>
            <input
              className="text-field"
              id="import-date"
              onChange={(event) => setImportDate(event.target.value)}
              type="date"
              value={importDate}
            />

            <label className="field-label mt-3" htmlFor="export-file">
              CSV / TXT 导出文件
            </label>
            <input
              accept=".csv,.txt,.tsv"
              className="file-field"
              id="export-file"
              onChange={handleFileLoad}
              type="file"
            />

            <label className="field-label mt-3" htmlFor="paste-links">
              粘贴导出链接
            </label>
            <textarea
              className="textarea-field"
              id="paste-links"
              onChange={(event) => setPasteText(event.target.value)}
              placeholder="粘贴包含 TikTok 视频链接的每日导出内容"
              value={pasteText}
            />
            <button className="primary-button mt-3" onClick={importLinks} type="button">
              导入视频链接
            </button>
          </div>

          <div className="panel">
            <div className="section-title">
              <span />
              <h2>当日榜单</h2>
            </div>
            <div className="video-list">
              {visibleVideos.map((video, index) => (
                <button
                  className={`video-row ${
                    activeVideo.id === video.id ? "video-row-active" : ""
                  }`}
                  key={video.id}
                  onClick={() => setActiveVideoId(video.id)}
                  type="button"
                >
                  <span className="rank">Top {index + 1}</span>
                  <span className="row-main">
                    <strong>{video.creator}</strong>
                    <small>{video.product}</small>
                  </span>
                  <span className="row-metric">
                    {video.orders > 0
                      ? `${formatNumber(video.orders)} 单`
                      : `${formatNumber(video.views)} 播放`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-5">
          <section className="panel video-detail">
            <div className="video-stage">
              <div className="phone-frame">
                <Image
                  alt={`${activeVideo.product} 视频封面`}
                  className="phone-image"
                  fill
                  priority
                  sizes="330px"
                  src={activeVideo.cover}
                />
                <div className="play-layer">
                  <span>播放预览</span>
                </div>
              </div>
              <p className="video-hint">点击链接可查看原 TikTok 视频</p>
            </div>

            <div className="detail-content">
              <div className="detail-heading">
                <div>
                  <p className="eyebrow">Top {activeRank} · {activeVideo.creator}</p>
                  <h2>{activeVideo.title}</h2>
                </div>
                <a className="link-button" href={activeVideo.link} rel="noreferrer" target="_blank">
                  打开链接
                </a>
              </div>

              <div className="metric-strip">
                <span className="hot">播放 {formatNumber(activeVideo.views)}</span>
                <span className="hot">点赞 {formatNumber(activeVideo.likes)}</span>
                <span className="hot">销量 {formatNumber(activeVideo.orders)}</span>
                <span className="hot">销售额 {formatMoney(activeVideo.revenue)}</span>
                <span className="soft">标价 ${activeVideo.price.toFixed(2)}</span>
                <span className="soft">{activeVideo.audience}</span>
                <span className="soft">{activeVideo.language}</span>
                <span className="soft">{activeVideo.category}</span>
              </div>

              <div className="section-title mt-5">
                <span />
                <h3>关键画面截图与脚本分析</h3>
              </div>
              <div className="frames-grid">
                {activeVideo.frames.map((frame) => (
                  <article className="frame-card" key={`${activeVideo.id}-${frame.time}`}>
                    <div className="frame-image-wrap">
                      <Image
                        alt={`${frame.time} ${frame.title}`}
                        className="frame-image"
                        fill
                        sizes="(max-width: 760px) 50vw, (max-width: 1180px) 33vw, 180px"
                        src={frame.image}
                      />
                    </div>
                    <strong>{frame.time}</strong>
                    <h4>{frame.title}</h4>
                    <p>{frame.note}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="analysis-grid">
            <article className="panel">
              <div className="section-title with-action">
                <div>
                  <span />
                  <h3>完整脚本</h3>
                </div>
                <button
                  className="secondary-button"
                  onClick={() =>
                    navigator.clipboard?.writeText(
                      activeVideo.script.map((line) => line.english).join("\n"),
                    )
                  }
                  type="button"
                >
                  复制英文
                </button>
              </div>
              <div className="script-table">
                <div className="script-row script-head">
                  <span>时间</span>
                  <span>English</span>
                  <span>中文</span>
                </div>
                {activeVideo.script.map((line) => (
                  <div className="script-row" key={`${line.time}-${line.english}`}>
                    <span>{line.time}</span>
                    <span>{line.english}</span>
                    <span>{line.chinese}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="section-title">
                <span />
                <h3>拆解</h3>
              </div>
              <div className="breakdown-table">
                <div>
                  <strong>Hook 类型</strong>
                  <p>{activeVideo.breakdown.hookType}</p>
                </div>
                <div>
                  <strong>Hook 拆解</strong>
                  <p>{activeVideo.breakdown.hook}</p>
                </div>
                <div>
                  <strong>卖点呈现</strong>
                  <p>{activeVideo.breakdown.sellingPoint}</p>
                </div>
                <div>
                  <strong>CTA</strong>
                  <p>{activeVideo.breakdown.cta}</p>
                </div>
                <div>
                  <strong>可复用套路</strong>
                  <p>{activeVideo.breakdown.reusable}</p>
                </div>
              </div>
            </article>

            <article className="panel">
              <div className="section-title">
                <span />
                <h3>爆款原因</h3>
              </div>
              <div className="reason-list">
                {activeVideo.reasons.map((reason, index) => (
                  <div className="reason-item" key={reason}>
                    <strong>{index + 1}</strong>
                    <p>{reason}</p>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </div>
      </section>
    </main>
  );
}
