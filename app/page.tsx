"use client";

import { useMemo, useState } from "react";
import siteVideoData from "@/data/site-dashboard.json";

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
  source?: {
    file: string;
    row: number;
    headers: Record<string, string>;
  };
};

const excelVideos = siteVideoData.records as VideoRecord[];

const seedVideos: VideoRecord[] = [
  {
    id: "sample-dashboard-row",
    date: "2026-07-01",
    creator: "@sample.creator",
    title: "示例视频数据",
    product: "示例视频数据",
    category: "TikTok Shop Mexico",
    audience: "Mexico / Spanish",
    language: "Spanish",
    link: "https://www.tiktok.com/",
    views: 0,
    likes: 0,
    comments: 0,
    orders: 0,
    soldItems: 0,
    revenue: 0,
    price: 0,
    ctr: 0,
    rpm: 0,
    commission: 0,
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

function sortVideosForDailyRank(videos: VideoRecord[]) {
  const hasOrders = videos.some((video) => video.orders > 0);

  return [...videos].sort((a, b) => {
    const orderDelta = b.orders - a.orders;
    const viewDelta = b.views - a.views;
    const likeDelta = b.likes - a.likes;

    if (hasOrders && orderDelta !== 0) {
      return orderDelta;
    }

    return viewDelta || likeDelta;
  });
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
    return sortVideosForDailyRank(filtered);
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
    ? "按成单从大到小"
    : "无成单，按播放从高到低";
  const weekLabel = getWeekLabel(selectedDate);
  const minDate = dates[dates.length - 1] ?? selectedDate;
  const maxDate = dates[0] ?? selectedDate;

  function selectDate(date: string) {
    if (!date) {
      return;
    }

    setSelectedDate(date);
    const firstForDate = sortVideosForDailyRank(
      allVideos.filter((video) => video.date === date),
    )[0];

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
                    <strong>{formatNumber(video.orders)} 单</strong>
                    <small>{formatNumber(video.views)} 播放</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-5">
          <section className="panel detail-dashboard">
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

              <div className="hero-metrics">
                <article className="hero-metric hero-metric-orders">
                  <span>联盟订单量</span>
                  <strong>{formatNumber(activeVideo.orders)}</strong>
                  <small>{getMetricSource(activeVideo, "orders") || "来自飞书同步字段"}</small>
                </article>
                <article className="hero-metric hero-metric-views">
                  <span>视频浏览量</span>
                  <strong>{formatNumber(activeVideo.views)}</strong>
                  <small>{getMetricSource(activeVideo, "views") || "来自飞书同步字段"}</small>
                </article>
              </div>

              <div className="metric-strip">
                <span className="hot" title={getMetricSource(activeVideo, "likes")}>
                  点赞 {formatNumber(activeVideo.likes)}
                </span>
                <span className="hot" title={getMetricSource(activeVideo, "comments")}>
                  评论 {formatNumber(activeVideo.comments ?? 0)}
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
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
