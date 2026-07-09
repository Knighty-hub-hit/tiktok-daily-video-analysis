import { readFile } from "node:fs/promises";

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

function formatSignedNumber(value) {
  const number = Number(value) || 0;

  if (number === 0) {
    return "持平";
  }

  return `${number > 0 ? "+" : "-"}${formatNumber(Math.abs(number))}`;
}

function formatSignedMoney(value) {
  const number = Number(value) || 0;

  if (number === 0) {
    return "持平";
  }

  return `${number > 0 ? "+" : "-"}${formatMoney(Math.abs(number))}`;
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
      records: [],
    };

    summary.count += 1;
    summary.orders += Number(record.orders) || 0;
    summary.revenue += Number(record.revenue) || 0;
    summary.views += Number(record.views) || 0;
    summary.likes += Number(record.likes) || 0;
    summary.comments += Number(record.comments) || 0;
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
    records: [],
  };
  const previousSummary = byDate.get(previousDate) ?? {
    count: 0,
    orders: 0,
    revenue: 0,
    views: 0,
    likes: 0,
    comments: 0,
    records: [],
  };

  latestSummary.records.sort(
    (a, b) =>
      (Number(b.orders) || 0) - (Number(a.orders) || 0) ||
      (Number(b.revenue) || 0) - (Number(a.revenue) || 0) ||
      (Number(b.views) || 0) - (Number(a.views) || 0),
  );

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
  const { latestDate, latestSummary, previousDate, previousSummary } = summarizeRecords(records);
  const siteUrl = getEnv("SITE_PUBLIC_URL", "NEXT_PUBLIC_SITE_URL") || DEFAULT_SITE_URL;
  const backupSiteUrl = getEnv("SITE_BACKUP_URL", "NEXT_PUBLIC_BACKUP_SITE_URL") || DEFAULT_BACKUP_SITE_URL;
  const sheetUrl = getEnv("FEISHU_SHEET_URL", "LARK_SHEET_URL") || DEFAULT_SHEET_URL;
  const topRecord = latestSummary.records[0];
  const countDelta = latestSummary.count - previousSummary.count;
  const orderDelta = latestSummary.orders - previousSummary.orders;
  const revenueDelta = latestSummary.revenue - previousSummary.revenue;
  const topLines = latestSummary.records.slice(0, 5).map((record, index) => {
    const title = clip(record.title || record.product || record.link);
    return `${index + 1}. ${record.creator}｜${formatMoney(record.revenue)}｜${formatNumber(record.orders)} 单｜${formatNumber(record.views)} 曝光｜${title}`;
  });
  const focusLines = [
    `新视频 ${formatNumber(latestSummary.count)} 条${previousDate ? `（较 ${previousDate} ${formatSignedNumber(countDelta)}）` : ""}`,
    `订单 ${formatNumber(latestSummary.orders)} 单${previousDate ? `（较 ${previousDate} ${formatSignedNumber(orderDelta)}）` : ""}`,
    `GMV ${formatMoney(latestSummary.revenue)}${previousDate ? `（较 ${previousDate} ${formatSignedMoney(revenueDelta)}）` : ""}`,
    topRecord ? `Top 1 ${topRecord.creator}｜${clip(topRecord.title || topRecord.product, 32)}` : "暂无 Top 视频",
  ];
  const statusLine =
    latestSummary.orders > 0
      ? "有出单视频，优先复盘成交 Hook、卖点证明和 CTA。"
      : "今日暂无出单，优先看新增素材、首屏画面和后续点击变化。";

  return [
    "【重点】TikTok 每日爆款视频拆解已更新",
    focusLines.join("\n"),
    "",
    "【今日概览】",
    `日期：${latestDate || "暂无日期"}`,
    `视频：${formatNumber(latestSummary.count)} 条｜累计 ${formatNumber(records.length)} 条`,
    `GMV：${formatMoney(latestSummary.revenue)}｜订单：${formatNumber(latestSummary.orders)}｜曝光：${formatNumber(latestSummary.views)}`,
    `互动：点赞 ${formatNumber(latestSummary.likes)}｜评论 ${formatNumber(latestSummary.comments)}`,
    `状态：${statusLine}`,
    "",
    "【Top 视频】",
    ...(topLines.length ? topLines : ["暂无可展示视频"]),
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
