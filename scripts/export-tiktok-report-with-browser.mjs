import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const DEFAULT_TIKTOK_VIDEO_URL =
  "https://affiliate.tiktok.com/data/video?shop_region=MX&shop_id=7496266260600883350";
const DEFAULT_OUTPUT_PATH = `data/exports/tiktok-report-${new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Shanghai",
  year: "numeric",
}).format(new Date())}.xlsx`;

const targetUrl = process.env.TIKTOK_EXPORT_PAGE_URL || DEFAULT_TIKTOK_VIDEO_URL;
const statePath = process.env.TIKTOK_STORAGE_STATE_PATH || ".auth/tiktok-storage-state.json";
const outputPath = process.env.TIKTOK_REPORT_OUTPUT || DEFAULT_OUTPUT_PATH;
const downloadDir = process.env.TIKTOK_DOWNLOAD_DIR || ".tmp/tiktok-downloads";
const timeoutMs = Number.parseInt(process.env.TIKTOK_EXPORT_TIMEOUT_MS ?? "120000", 10);
const headless = process.env.TIKTOK_EXPORT_HEADLESS !== "0";
const channel = process.env.TIKTOK_BROWSER_CHANNEL || undefined;

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isLoginUrl(url) {
  return /login|passport|signin/i.test(String(url));
}

async function pageLooksLoggedOut(page) {
  if (isLoginUrl(page.url())) {
    return true;
  }

  const loginText = page.getByText(/登录|Log in|Sign in/i).first();

  try {
    return await loginText.isVisible({ timeout: 2000 });
  } catch {
    return false;
  }
}

async function clickLocator(locator, timeout = 5000) {
  const count = await locator.count().catch(() => 0);

  for (let index = 0; index < count; index += 1) {
    const item = locator.nth(index);

    try {
      if (await item.isVisible({ timeout: 1000 })) {
        await item.click({ timeout });
        return true;
      }
    } catch {
      // Try the next matching element.
    }
  }

  return false;
}

async function clickExport(page) {
  const candidates = [
    page.getByRole("button", { name: /导出数据|导出|Export data|Export/i }),
    page.getByText(/导出数据|Export data/i),
    page.locator("button").filter({ hasText: /导出数据|导出|Export data|Export/i }),
    page.locator("[role='button']").filter({ hasText: /导出数据|导出|Export data|Export/i }),
  ];

  for (const locator of candidates) {
    if (await clickLocator(locator)) {
      return true;
    }
  }

  return false;
}

async function clickConfirmExport(page) {
  const candidates = [
    page.getByRole("button", { name: /确认|确定|下载|导出|Confirm|Download|Export/i }),
    page.locator("button").filter({ hasText: /确认|确定|下载|导出|Confirm|Download|Export/i }),
    page.locator("[role='button']").filter({ hasText: /确认|确定|下载|导出|Confirm|Download|Export/i }),
  ];

  for (const locator of candidates) {
    if (await clickLocator(locator, 3000)) {
      return true;
    }
  }

  return false;
}

async function waitForDownloadAfter(action, page, timeout = 20000) {
  const downloadPromise = page.waitForEvent("download", { timeout }).catch(() => null);
  await action();
  return downloadPromise;
}

async function saveDebugArtifacts(page) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const screenshotPath = `data/exports/tiktok-export-failure-${timestamp}.png`;
  const htmlPath = `data/exports/tiktok-export-failure-${timestamp}.html`;
  await mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
  await writeFile(htmlPath, await page.content()).catch(() => {});
  return { screenshotPath, htmlPath };
}

if (!(await fileExists(statePath))) {
  throw new Error(`Missing TikTok storage state: ${statePath}. Run npm run tiktok:session first.`);
}

await mkdir(path.dirname(outputPath), { recursive: true });
await mkdir(downloadDir, { recursive: true });

const storageState = JSON.parse(await readFile(statePath, "utf8"));
const browser = await chromium.launch({ channel, headless });
const context = await browser.newContext({
  acceptDownloads: true,
  downloadsPath: downloadDir,
  storageState,
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();

try {
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});

  if (await pageLooksLoggedOut(page)) {
    throw new Error("TikTok session is logged out or expired. Refresh TIKTOK_STORAGE_STATE_B64.");
  }

  let download = await waitForDownloadAfter(async () => {
    const clicked = await clickExport(page);

    if (!clicked) {
      throw new Error("Cannot find TikTok export button.");
    }
  }, page);

  if (!download) {
    download = await waitForDownloadAfter(async () => {
      const clicked = await clickConfirmExport(page);

      if (!clicked) {
        throw new Error("Export did not download and no confirmation button was found.");
      }
    }, page, 30000);
  }

  if (!download) {
    const debug = await saveDebugArtifacts(page);
    throw new Error(
      `TikTok export did not produce a download. Debug saved: ${debug.screenshotPath}, ${debug.htmlPath}`,
    );
  }

  await download.saveAs(outputPath);

  const size = (await stat(outputPath)).size;
  const data = await readFile(outputPath);

  if (size === 0) {
    throw new Error("Downloaded TikTok report is empty.");
  }

  if (path.extname(outputPath).toLowerCase() === ".xlsx" && data.subarray(0, 2).toString() !== "PK") {
    throw new Error("Downloaded TikTok report is not an XLSX file.");
  }

  console.log(outputPath);
} finally {
  await context.close();
  await browser.close();
}
