const DEFAULT_SITE_URL = "https://xinchimcn.aiforce.cloud/app/app_179t4tka49p";

function getEnv(...names) {
  for (const name of names) {
    const value = process.env[name];

    if (value) {
      return value;
    }
  }

  return "";
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
    throw new Error("Missing LARK_APP_ID/LARK_APP_SECRET for Feishu workflow alert.");
  }

  const data = await feishuRequest("/open-apis/auth/v3/tenant_access_token/internal", "", {
    method: "POST",
    body: JSON.stringify({
      app_id: appId,
      app_secret: appSecret,
    }),
  });

  return data.tenant_access_token;
}

async function sendTextMessage(token, chatId, text) {
  const data = await feishuRequest("/open-apis/im/v1/messages?receive_id_type=chat_id", token, {
    method: "POST",
    body: JSON.stringify({
      receive_id: chatId,
      msg_type: "text",
      content: JSON.stringify({ text }),
      uuid: getEnv("GITHUB_RUN_ID") ? `tiktok-site-alert-${process.env.GITHUB_RUN_ID}` : undefined,
    }),
  });

  return data.message_id ?? data.message?.message_id ?? "";
}

function buildAlertMessage() {
  const sourceMode = process.env.WORKFLOW_SOURCE_MODE || "";
  const repo = process.env.GITHUB_REPOSITORY || "Knighty-hub-hit/tiktok-daily-video-analysis";
  const runId = process.env.GITHUB_RUN_ID || "";
  const runUrl = runId ? `https://github.com/${repo}/actions/runs/${runId}` : "";
  const siteUrl = getEnv("SITE_PUBLIC_URL", "NEXT_PUBLIC_SITE_URL") || DEFAULT_SITE_URL;
  const reason =
    sourceMode === "missing-report"
      ? "缺少 TikTok 数据源：当前没有可用的 TIKTOK_REPORT_URL，也还没有配置 TIKTOK_STORAGE_STATE_B64 或 TIKTOK_LOGIN_USERNAME/TIKTOK_LOGIN_PASSWORD。"
      : "GitHub Actions 主链路失败，需要查看运行日志定位具体步骤。";

  return [
    "TikTok 每日爆款视频拆解自动更新失败",
    "【失败原因】",
    reason,
    "",
    "【影响】",
    "今天没有完成自动导出、写入飞书、刷新网站和群推送。",
    "",
    "【下一步】",
    "配置 TikTok 浏览器登录态或账号密码后重跑 workflow；如果触发验证码/二次验证，需要人工验证一次。",
    "",
    "【入口】",
    `运行记录：${runUrl || "暂无"}`,
    `网站：${siteUrl}`,
  ].join("\n");
}

async function main() {
  const chatId = getEnv("LARK_TARGET_CHAT_ID", "FEISHU_TARGET_CHAT_ID");

  if (!chatId) {
    throw new Error("Missing LARK_TARGET_CHAT_ID/FEISHU_TARGET_CHAT_ID for Feishu workflow alert.");
  }

  const token = await getTenantAccessToken();
  const messageId = await sendTextMessage(token, chatId, buildAlertMessage());
  console.log(JSON.stringify({ ok: true, chatId, messageId }, null, 2));
}

await main();
