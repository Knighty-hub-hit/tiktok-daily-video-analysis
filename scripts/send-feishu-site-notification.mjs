import { readFile } from "node:fs/promises";
import { sortRecordsForDailyRank } from "./site-data-builder.mjs";

const DEFAULT_SITE_URL = "https://xinchimcn.aiforce.cloud/app/app_179t4tka49p";
const DEFAULT_BACKUP_SITE_URL = "https://knighty-hub-hit.github.io/tiktok-daily-video-analysis/";
const DEFAULT_SHEET_URL =
  "https://xinchimcn.feishu.cn/wiki/VUs4wyJ6Mi1MlHkhQkCcrx8hnvh?table=tbltCfy5ZsMAkNw0&view=vewW7k3x0w&sheet=hlCeKL";
const DEFAULT_TARGET_CHAT_NAME = "墨区小组";

function getEnv(...names) {
  for (const name of names) {
    const value = process.env[name];

    if (value) {
      return value;
    }
  }

  return "";
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatMoney(value) {
  return `MX$${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(Number(value) || 0)}`;
}

function summarizeRecords(records) {
  const byDate = new Map();

  for (const record of records) {
    const summary = byDate.get(record.date) ?? {
      count: 0,
      orders: 0,
      revenue: 0,
      views: 0,
      likes: 0,
      comments: 0,
      orderedVideoCount: 0,
      records: [],
    };

    summary.count += 1;
    summary.orders += Number(record.orders) || 0;
    summary.revenue += Number(record.revenue) || 0;
    summary.views += Number(record.views) || 0;
    summary.likes += Number(record.likes) || 0;
    summary.comments += Number(record.comments) || 0;
    summary.orderedVideoCount += Number(record.orders) > 0 ? 1 : 0;
    summary.records.push(record);
    byDate.set(record.date, summary);
  }

  const sortedDates = Array.from(byDate.keys()).sort();
  const latestDate = sortedDates.at(-1) ?? "";
  const previousDate = sortedDates.at(-2) ?? "";
  const latestSummary = byDate.get(latestDate) ?? {
    count: 0,
    orders: 0,
    revenue: 0,
    views: 0,
    likes: 0,
    comments: 0,
    orderedVideoCount: 0,
    records: [],
  };
  const previousSummary = byDate.get(previousDate) ?? {
    count: 0,
    orders: 0,
    revenue: 0,
    views: 0,
    likes: 0,
    comments: 0,
    orderedVideoCount: 0,
    records: [],
  };

  latestSummary.records = sortRecordsForDailyRank(latestSummary.records);

  return { latestDate, latestSummary, previousDate, previousSummary };
}

function clip(value, maxLength = 54) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1)}...`;
}

function buildMessage(data) {
  const records = Array.isArray(data.records) ? data.records : [];
  const { latestDate, latestSummary } = summarizeRecords(records);
  const siteUrl = getEnv("SITE_PUBLIC_URL", "NEXT_PUBLIC_SITE_URL") || DEFAULT_SITE_URL;
  const backupSiteUrl = getEnv("SITE_BACKUP_URL", "NEXT_PUBLIC_BACKUP_SITE_URL") || DEFAULT_BACKUP_SITE_URL;
  const sheetUrl = getEnv("FEISHU_SHEET_URL", "LARK_SHEET_URL") || DEFAULT_SHEET_URL;
  const orderedRecords = latestSummary.records.filter((record) => Number(record.orders) > 0);
  const orderedTopLines = orderedRecords.slice(0, 5).map((record, index) => {
    const title = clip(record.title || record.product || record.link, 42);
    return [
      `${index + 1}. ${record.creator}｜${formatNumber(record.orders)} 单｜GMV ${formatMoney(record.revenue)}｜播放 ${formatNumber(record.views)}`,
      `   ${title}`,
      `   ${record.link}`,
    ].join("\n");
  });
  const viewTopLines = latestSummary.records.slice(0, 5).map((record, index) => {
    const title = clip(record.title || record.product || record.link);
    return `${index + 1}. ${record.creator}｜${formatNumber(record.orders)} 单｜播放 ${formatNumber(record.views)}｜${title}`;
  });
  const statusLine =
    latestSummary.orders > 0
      ? "今日有出单视频，优先看出单 Top 的达人、视频链接和后续复投价值。"
      : "今日暂无出单视频，先看播放 Top 和后续点击、订单变化。";

  return [
    "TikTok 每日爆款视频拆解已更新",
    "【今日概览】",
    `日期：${latestDate || "暂无日期"}`,
    `新视频总数：${formatNumber(latestSummary.count)} 条`,
    `出单视频数：${formatNumber(latestSummary.orderedVideoCount)} 条`,
    `新视频 GMV：${formatMoney(latestSummary.revenue)}`,
    `订单合计：${formatNumber(latestSummary.orders)} 单｜播放合计：${formatNumber(latestSummary.views)}`,
    `互动：点赞 ${formatNumber(latestSummary.likes)}｜评论 ${formatNumber(latestSummary.comments)}`,
    `累计入库：${formatNumber(records.length)} 条`,
    `状态：${statusLine}`,
    "",
    "【出单 Top】",
    ...(orderedTopLines.length ? orderedTopLines : ["今日暂无出单视频"]),
    "",
    "【播放 Top】",
    ...(viewTopLines.length ? viewTopLines : ["暂无可展示视频"]),
    "",
    "【打开入口】",
    `网站：${siteUrl}`,
    `备用链接：${backupSiteUrl}`,
    `飞书表格：${sheetUrl}`,
  ].join("\n");
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
    throw new Error("Missing LARK_APP_ID/LARK_APP_SECRET for Feishu bot notification.");
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

async function resolveChatId(token) {
  const configuredChatId = getEnv("LARK_TARGET_CHAT_ID", "FEISHU_TARGET_CHAT_ID");

  if (configuredChatId) {
    return configuredChatId;
  }

  const targetChatName = getEnv("LARK_TARGET_CHAT_NAME", "FEISHU_TARGET_CHAT_NAME") || DEFAULT_TARGET_CHAT_NAME;
  const data = await feishuRequest("/open-apis/im/v2/chats/search?page_size=20", token, {
    method: "POST",
    body: JSON.stringify({
      query: targetChatName,
    }),
  });
  const chats = data.items ?? data.chats ?? [];
  const exactMatch = chats.find((chat) => chat.name === targetChatName);
  const match = exactMatch ?? chats[0];

  if (!match?.chat_id) {
    throw new Error(
      `Cannot find Feishu chat "${targetChatName}". Add the bot to the group or set LARK_TARGET_CHAT_ID in GitHub Secrets.`,
    );
  }

  return match.chat_id;
}

async function sendTextMessage(token, chatId, text) {
  const data = await feishuRequest("/open-apis/im/v1/messages?receive_id_type=chat_id", token, {
    method: "POST",
    body: JSON.stringify({
      receive_id: chatId,
      msg_type: "text",
      content: JSON.stringify({ text }),
      uuid: getEnv("GITHUB_RUN_ID") ? `tiktok-site-${process.env.GITHUB_RUN_ID}` : undefined,
    }),
  });

  return data.message_id ?? data.message?.message_id ?? "";
}

async function main() {
  const positionalArgs = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const dataPath = positionalArgs[0] ?? "data/site-videos.json";
  const data = JSON.parse(await readFile(dataPath, "utf8"));
  const message = buildMessage(data);

  if (process.env.FEISHU_NOTIFY_DRY_RUN === "1" || process.argv.includes("--dry-run")) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: true,
          targetChatName: getEnv("LARK_TARGET_CHAT_NAME", "FEISHU_TARGET_CHAT_NAME") || DEFAULT_TARGET_CHAT_NAME,
          targetChatId: getEnv("LARK_TARGET_CHAT_ID", "FEISHU_TARGET_CHAT_ID") || null,
          message,
        },
        null,
        2,
      ),
    );
    return;
  }

  const token = await getTenantAccessToken();
  const chatId = await resolveChatId(token);
  const messageId = await sendTextMessage(token, chatId, message);
  console.log(JSON.stringify({ ok: true, chatId, messageId }, null, 2));
}

await main();
