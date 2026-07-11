import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const DEFAULT_TIKTOK_VIDEO_URL =
  "https://affiliate.tiktok.com/data/video?shop_region=MX&shop_id=7496266260600883350";

const targetUrl = process.env.TIKTOK_EXPORT_PAGE_URL || DEFAULT_TIKTOK_VIDEO_URL;
const statePath = process.env.TIKTOK_STORAGE_STATE_PATH || ".auth/tiktok-storage-state.json";
const userDataDir = process.env.TIKTOK_SESSION_USER_DATA_DIR || ".auth/tiktok-session-browser";
const channel = process.env.TIKTOK_BROWSER_CHANNEL || (process.platform === "darwin" ? "chrome" : undefined);

function hasTikTokSession(cookies) {
  return cookies.some((cookie) => {
    const name = String(cookie.name ?? "").toLowerCase();
    const domain = String(cookie.domain ?? "").toLowerCase();
    return domain.includes("tiktok") && /(session|sid|passport|csrf)/.test(name);
  });
}

async function hasExportButton(page) {
  const candidates = [
    page.getByRole("button", { name: /导出数据|导出|Export data|Export/i }).first(),
    page.getByText(/导出数据|Export data/i).first(),
    page.locator("button").filter({ hasText: /导出数据|导出|Export data|Export/i }).first(),
    page.locator("[role='button']").filter({ hasText: /导出数据|导出|Export data|Export/i }).first(),
  ];

  for (const locator of candidates) {
    try {
      if (await locator.isVisible({ timeout: 1000 })) {
        return true;
      }
    } catch {
      // Try the next candidate.
    }
  }

  return false;
}

await mkdir(path.dirname(statePath), { recursive: true });
await mkdir(userDataDir, { recursive: true });

const context = await chromium.launchPersistentContext(userDataDir, {
  channel,
  headless: false,
  viewport: { width: 1440, height: 1000 },
});

const page = context.pages()[0] ?? (await context.newPage());
await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 120000 });

console.log("TikTok login window opened.");
console.log("Log in if needed, then leave the browser on the TikTok Affiliate video data page.");
console.log(`Target page: ${targetUrl}`);
console.log(`Storage state will be saved to: ${statePath}`);
console.log("Waiting until the video data page is open and the export button is visible.");

const deadline = Date.now() + 10 * 60 * 1000;
let saved = false;

while (Date.now() < deadline) {
  await page.waitForTimeout(3000);
  const cookies = await context.cookies();
  const url = page.url();
  const exportReady = url.includes("affiliate.tiktok.com/data/video") && (await hasExportButton(page));
  const sessionReady = exportReady || (url.includes("affiliate.tiktok.com/data/video") && hasTikTokSession(cookies));

  if (sessionReady) {
    try {
      await context.storageState({ indexedDB: true, path: statePath });
    } catch (error) {
      console.warn(`IndexedDB storageState failed, falling back to cookies/localStorage only: ${error.message}`);
      await context.storageState({ path: statePath });
    }
    saved = true;
    console.log(`Saved TikTok storage state: ${statePath}`);
    break;
  }
}

await context.close();

if (!saved) {
  throw new Error("Timed out waiting for a logged-in TikTok Affiliate session.");
}
