"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import siteVideoData from "@/data/site-videos.json";

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
  comments?: number;
  orders: number;
  soldItems?: number;
  revenue: number;
  price: number;
  ctr?: number;
  rpm?: number;
  commission?: number;
  cover: string;
  videoFile?: string;
  videoReady?: boolean;
  mediaType?: "video" | "gif";
  transcriptFile?: string;
  frames: Frame[];
  script: ScriptLine[];
  breakdown: Breakdown;
  reasons: string[];
  source?: {
    file: string;
    row: number;
    headers: Record<string, string>;
  };
};

const excelVideos = siteVideoData.records as VideoRecord[];

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

function formatPercent(value: number | undefined) {
  return `${(value ?? 0).toFixed(2)}%`;
}

function getMetricSource(video: VideoRecord, metric: string) {
  const field = video.source?.headers[metric];

  if (!video.source || !field) {
    return "";
  }

  return `${field} · 第 ${video.source.row} 行`;
}

function getPageBounds(range: string) {
  const match = range.match(/Top\s+(\d+)-(\d+)/);

  if (!match) {
    return { start: 0, end: 10 };
  }

  return {
    start: Number(match[1]) - 1,
    end: Number(match[2]),
  };
}

function getWeekLabel(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "选择日期";
  }

  const firstDay = new Date(date.getFullYear(), 0, 1);
  const pastDays = Math.floor(
    (date.getTime() - firstDay.getTime()) / 86400000,
  );
  const week = Math.ceil((pastDays + firstDay.getDay() + 1) / 7);

  return `${date.getFullYear()} 第 ${week} 周`;
}

export default function Home() {
  const baseVideos = excelVideos.length > 0 ? excelVideos : seedVideos;
  const [selectedDate, setSelectedDate] = useState(baseVideos[0].date);
  const [activeVideoId, setActiveVideoId] = useState(baseVideos[0].id);
  const pageRange = "Top 1-10";
  const allVideos = baseVideos;

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

  const pageBounds = getPageBounds(pageRange);
  const pageVideos = visibleVideos.slice(pageBounds.start, pageBounds.end);
  const activeVideo =
    pageVideos.find((video) => video.id === activeVideoId) ??
    pageVideos[0] ??
    visibleVideos[0] ??
    allVideos[0];
  const activeRank =
    visibleVideos.findIndex((video) => video.id === activeVideo.id) + 1 || 1;

  const sortLabel = visibleVideos.some((video) => video.orders > 0)
    ? "出单量从大到小"
    : "无出单，按流量从好到坏";
  const weekLabel = getWeekLabel(selectedDate);
  const minDate = dates[dates.length - 1] ?? selectedDate;
  const maxDate = dates[0] ?? selectedDate;

  function selectDate(date: string) {
    if (!date) {
      return;
    }

    setSelectedDate(date);
    const firstForDate = allVideos.find((video) => video.date === date);

    if (firstForDate) {
      setActiveVideoId(firstForDate.id);
    }
  }

  return (
    <main className="min-h-screen bg-[#f3f3f4] text-[#1f2933]">
      <section className="toolbar-shell">
        <div className="site-heading">
          <span>HALOVIDA Mexico</span>
          <h1>TikTok 每日爆款视频拆解</h1>
        </div>
        <div className="filter-bar clean-filter">
          <div className="week-pill">
            <span className="calendar-mark">▣</span>
            {weekLabel}
          </div>
          <label className="calendar-select" htmlFor="date-picker">
            <span>选择日期</span>
            <input
              id="date-picker"
              max={maxDate}
              min={minDate}
              onChange={(event) => selectDate(event.target.value)}
              type="date"
              value={selectedDate}
            />
          </label>
          <label className="calendar-select" htmlFor="date-list">
            <span>日期拉表</span>
            <select
              id="date-list"
              onChange={(event) => selectDate(event.target.value)}
              value={selectedDate}
            >
              {dates.map((date) => (
                <option key={date} value={date}>
                  {date}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1560px] gap-5 px-5 py-5 lg:grid-cols-[360px_minmax(0,1fr)] lg:px-8">
        <aside className="flex flex-col gap-4">
          <div className="panel">
            <div className="section-title with-action">
              <div>
                <span />
                <h2>每日榜单</h2>
              </div>
              <small>{sortLabel}</small>
            </div>
            <div className="ranking-summary">
              {selectedDate} · Top {pageBounds.start + 1}-{pageBounds.end}
            </div>
            <div className="video-list">
              {pageVideos.map((video, index) => (
                <button
                  className={`video-row ${
                    activeVideo.id === video.id ? "video-row-active" : ""
                  }`}
                  key={video.id}
                  onClick={() => setActiveVideoId(video.id)}
                  type="button"
                >
                  <span className="rank">Top {pageBounds.start + index + 1}</span>
                  <span className="row-main">
                    <strong>{video.creator}</strong>
                    <small>{video.product}</small>
                  </span>
                  <span className="row-metric">
                    {video.orders > 0
                      ? `${formatNumber(video.orders)} 单`
                      : `${formatNumber(video.views)} 播放`}
                  </span>
                  <span className="row-preview" aria-hidden="true">
                    <Image
                      alt=""
                      className="row-preview-image"
                      fill
                      sizes="180px"
                      src={video.videoReady && video.videoFile ? video.videoFile : video.cover}
                      unoptimized={video.mediaType === "gif"}
                    />
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
                {activeVideo.videoReady &&
                activeVideo.videoFile &&
                activeVideo.mediaType === "gif" ? (
                  <Image
                    alt={`${activeVideo.product} 视频动图预览`}
                    className="phone-image"
                    fill
                    priority
                    sizes="330px"
                    src={activeVideo.videoFile}
                    unoptimized
                  />
                ) : activeVideo.videoReady && activeVideo.videoFile ? (
                  <video
                    className="phone-video"
                    controls
                    playsInline
                    poster={activeVideo.cover}
                    src={activeVideo.videoFile}
                  />
                ) : (
                  <Image
                    alt={`${activeVideo.product} 视频封面`}
                    className="phone-image"
                    fill
                    priority
                    sizes="330px"
                    src={activeVideo.cover}
                  />
                )}
                <div className="play-layer">
                  <span>{activeVideo.videoReady ? "本地视频" : "待下载视频"}</span>
                </div>
              </div>
              <p className="video-hint">
                {activeVideo.videoReady
                  ? "视频已下载到站点，可直接播放"
                  : "暂未下载到本地，点击链接可查看原 TikTok 视频"}
              </p>
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
                <span className="hot" title={getMetricSource(activeVideo, "views")}>
                  曝光 {formatNumber(activeVideo.views)}
                </span>
                <span className="hot" title={getMetricSource(activeVideo, "likes")}>
                  点赞 {formatNumber(activeVideo.likes)}
                </span>
                <span className="hot" title={getMetricSource(activeVideo, "comments")}>
                  评论 {formatNumber(activeVideo.comments ?? 0)}
                </span>
                <span className="hot" title={getMetricSource(activeVideo, "orders")}>
                  联盟订单 {formatNumber(activeVideo.orders)}
                </span>
                <span className="hot" title={getMetricSource(activeVideo, "revenue")}>
                  GMV {formatMoney(activeVideo.revenue)}
                </span>
                <span className="soft" title={getMetricSource(activeVideo, "ctr")}>
                  点击率 {formatPercent(activeVideo.ctr)}
                </span>
                <span className="soft">客单 ${activeVideo.price.toFixed(2)}</span>
                <span className="soft">{activeVideo.audience}</span>
                <span className="soft">{activeVideo.language}</span>
                <span className="soft">{activeVideo.category}</span>
              </div>

              {activeVideo.source ? (
                <div className="source-note">
                  <strong>数据依据</strong>
                  <span>
                    {activeVideo.source.file} 第 {activeVideo.source.row} 行：
                    {Object.values(activeVideo.source.headers).join(" / ")}
                  </span>
                </div>
              ) : null}

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
                  <span>原文/口播</span>
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
