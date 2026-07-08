import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const reportUrl = process.argv[2] || process.env.TIKTOK_REPORT_URL;
const outputPath =
  process.env.TIKTOK_REPORT_OUTPUT ||
  `data/exports/tiktok-report-${new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).format(new Date())}.xlsx`;

if (!reportUrl) {
  console.error("Missing TikTok report URL. Set TIKTOK_REPORT_URL or pass a URL argument.");
  process.exit(78);
}

const headers = new Headers();
const authorization = process.env.TIKTOK_REPORT_AUTHORIZATION;
const cookie = process.env.TIKTOK_REPORT_COOKIE;
const userAgent =
  process.env.TIKTOK_REPORT_USER_AGENT ||
  "tiktok-daily-video-analysis/1.0 (+github-actions)";

headers.set("user-agent", userAgent);

if (authorization) {
  headers.set("authorization", authorization);
}

if (cookie) {
  headers.set("cookie", cookie);
}

const response = await fetch(reportUrl, {
  headers,
  redirect: "follow",
});

if (!response.ok) {
  throw new Error(`Failed to download report: HTTP ${response.status} ${response.statusText}`);
}

const contentType = response.headers.get("content-type") ?? "";
const data = Buffer.from(await response.arrayBuffer());

if (data.length === 0) {
  throw new Error("Downloaded report is empty.");
}

if (contentType.includes("text/html")) {
  throw new Error(
    "Downloaded report looks like HTML. The URL likely requires login or returned an error page.",
  );
}

if (path.extname(outputPath).toLowerCase() === ".xlsx" && data.subarray(0, 2).toString() !== "PK") {
  throw new Error("Downloaded report is not an XLSX file.");
}

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, data);

console.log(outputPath);
