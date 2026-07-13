import { existsSync, readFileSync } from "node:fs";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

function loadLocalEnv(filePath = ".env.local") {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;

    if (process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = rawValue
      .replace(/^['"]|['"]$/g, "")
      .replace(/\\n/g, "\n");
  }
}

loadLocalEnv();

const DEFAULT_TIKTOK_VIDEO_URL =
  "https://affiliate.tiktok.com/data/video?shop_region=MX&shop_id=7496266260600883350";
const DEFAULT_OUTPUT_PATH = `data/exports/tiktok-report-${new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Shanghai",
  year: "numeric",
}).format(new Date())}.xlsx`;

const targetUrl = process.env.TIKTOK_EXPORT_PAGE_URL || DEFAULT_TIKTOK_VIDEO_URL;
const loginUrl =
  process.env.TIKTOK_LOGIN_URL ||
  `https://seller-mx.tiktok.com/account/login?redirect_url=${encodeURIComponent(targetUrl)}`;
const statePath = process.env.TIKTOK_STORAGE_STATE_PATH || ".auth/tiktok-storage-state.json";
const outputPath = process.env.TIKTOK_REPORT_OUTPUT || DEFAULT_OUTPUT_PATH;
const downloadDir = process.env.TIKTOK_DOWNLOAD_DIR || ".tmp/tiktok-downloads";
const timeoutMs = Number.parseInt(process.env.TIKTOK_EXPORT_TIMEOUT_MS ?? "120000", 10);
const headless = process.env.TIKTOK_EXPORT_HEADLESS !== "0";
const channel = process.env.TIKTOK_BROWSER_CHANNEL || undefined;
const userDataDir = process.env.TIKTOK_SESSION_USER_DATA_DIR || "";
const loginUsername =
  process.env.TIKTOK_LOGIN_USERNAME ||
  process.env.TIKTOK_LOGIN_EMAIL ||
  process.env.TIKTOK_USERNAME ||
  process.env.TIKTOK_EMAIL ||
  "";
const loginPassword = process.env.TIKTOK_LOGIN_PASSWORD || process.env.TIKTOK_PASSWORD || "";
const hasLoginCredentials = Boolean(loginUsername && loginPassword);

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

  const bodyText = await page
    .locator("body")
    .innerText({ timeout: 2000 })
    .catch(() => "");

  if (
    !page.url().includes("affiliate.tiktok.com/data/video") &&
    /Turn views into sales|Start selling|Join now|Log in|Sign in|登录/i.test(bodyText)
  ) {
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

async function exportButtonVisible(page) {
  const candidates = [
    page.getByRole("button", { name: /导出数据|导出|Export data|Export/i }),
    page.getByText(/导出数据|Export data/i),
    page.locator("button").filter({ hasText: /导出数据|导出|Export data|Export/i }),
    page.locator("[role='button']").filter({ hasText: /导出数据|导出|Export data|Export/i }),
  ];

  for (const locator of candidates) {
    const count = await locator.count().catch(() => 0);

    for (let index = 0; index < count; index += 1) {
      try {
        if (await locator.nth(index).isVisible({ timeout: 1000 })) {
          return true;
        }
      } catch {
        // Try the next matching element.
      }
    }
  }

  return false;
}

async function waitForExportButton(page, timeout = timeoutMs) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    if (await pageNeedsHumanVerification(page)) {
      const debug = await saveDebugArtifacts(page);
      throw new Error(
        `TikTok requires captcha or two-step verification. Debug saved: ${debug.screenshotPath}, ${debug.htmlPath}`,
      );
    }

    if (await exportButtonVisible(page)) {
      return true;
    }

    await page.waitForTimeout(3000);
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

async function dismissCommonDialogs(page) {
  const candidates = [
    page.getByRole("button", { name: /接受|同意|允许|我知道了|Accept|Agree|Allow|Got it/i }),
    page.locator("button").filter({ hasText: /接受|同意|允许|我知道了|Accept|Agree|Allow|Got it/i }),
  ];

  for (const locator of candidates) {
    await clickLocator(locator, 1500).catch(() => false);
  }
}

async function fillFirstEditable(candidates, value) {
  for (const locator of candidates) {
    const count = Math.min(await locator.count().catch(() => 0), 8);

    for (let index = 0; index < count; index += 1) {
      const item = locator.nth(index);

      try {
        if (
          (await item.isVisible({ timeout: 1000 })) &&
          (await item.isEnabled({ timeout: 1000 })) &&
          (await item.isEditable({ timeout: 1000 }))
        ) {
          await item.fill(value, { timeout: 5000 });
          return item;
        }
      } catch {
        // Try the next candidate.
      }
    }
  }

  return null;
}

async function pageNeedsHumanVerification(page) {
  const verificationText = page.getByText(
    /验证码|验证|安全检查|二次验证|手机验证|邮箱验证|captcha|verify|verification|two-step|2-step|security check/i,
  );

  try {
    return await verificationText.first().isVisible({ timeout: 1500 });
  } catch {
    return false;
  }
}

async function switchToPasswordLogin(page) {
  const candidates = [
    page.getByText(/邮箱.*密码|手机.*密码|账号.*密码|密码登录|Use phone.*email|Use email|Email.*username|Log in with password|Correo|Email|Teléfono|Phone/i),
    page.locator("button").filter({
      hasText: /邮箱.*密码|手机.*密码|账号.*密码|密码登录|Use phone.*email|Use email|Email.*username|Log in with password|Correo|Email|Teléfono|Phone/i,
    }),
    page.locator("[role='tab']").filter({
      hasText: /邮箱|手机|账号|Email|Phone|Username|Correo|Teléfono/i,
    }),
  ];

  for (const locator of candidates) {
    if (await clickLocator(locator, 2500)) {
      await page.waitForTimeout(1000);
      return true;
    }
  }

  return false;
}

async function switchToEmailLogin(page) {
  const candidates = [
    page.getByText(/Iniciar sesión con email|Log in with email|Sign in with email|邮箱登录|邮件登录/i),
    page.locator("a").filter({ hasText: /Iniciar sesión con email|Log in with email|Sign in with email|邮箱登录|邮件登录/i }),
    page.locator("button").filter({ hasText: /Iniciar sesión con email|Log in with email|Sign in with email|邮箱登录|邮件登录/i }),
  ];

  for (const locator of candidates) {
    if (await clickLocator(locator, 3000)) {
      await page.waitForTimeout(1500);
      return true;
    }
  }

  return false;
}

async function clickLoginEntry(page) {
  const candidates = [
    page.getByRole("link", { name: /^登录$|^Log in$|^Sign in$|^Iniciar sesión$/i }),
    page.getByRole("button", { name: /^登录$|^Log in$|^Sign in$|^Iniciar sesión$/i }),
    page.locator("a").filter({ hasText: /^登录$|^Log in$|^Sign in$|^Iniciar sesión$/i }),
    page.locator("button").filter({ hasText: /^登录$|^Log in$|^Sign in$|^Iniciar sesión$/i }),
    page.getByText(/^登录$|^Log in$|^Sign in$|^Iniciar sesión$/i),
  ];

  for (const locator of candidates) {
    if (await clickLocator(locator, 5000)) {
      await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500);
      return true;
    }
  }

  return false;
}

async function loginWithCredentials(page) {
  if (!isLoginUrl(page.url()) || /seller-us\.tiktok\.com\/account\/register|seller\.tiktok\.com/i.test(page.url())) {
    await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  }

  await dismissCommonDialogs(page);
  await clickLoginEntry(page);
  if (loginUsername.includes("@")) {
    await switchToEmailLogin(page);
  }
  await switchToPasswordLogin(page);
  await page
    .waitForSelector("input, textarea, [contenteditable='true']", {
      state: "visible",
      timeout: 60000,
    })
    .catch(() => {});

  const usernameInput = await fillFirstEditable(
    [
      page.locator('input[autocomplete="username"]'),
      page.locator('input[name*="email" i]'),
      page.locator('input[name*="user" i]'),
      page.locator('input[type="email"]'),
      page.locator('input[placeholder*="邮箱"]'),
      page.locator('input[placeholder*="手机号"]'),
      page.locator('input[placeholder*="手机"]'),
      page.locator('input[placeholder*="账号"]'),
      page.locator('input[placeholder*="correo" i]'),
      page.locator('input[placeholder*="teléfono" i]'),
      page.locator('input[placeholder*="telefono" i]'),
      page.locator('input[placeholder*="usuario" i]'),
      page.locator('input[placeholder*="Email" i]'),
      page.locator('input[placeholder*="Phone" i]'),
      page.locator('input[placeholder*="Username" i]'),
      page.locator('input[type="text"]'),
    ],
    loginUsername,
  );

  if (!usernameInput) {
    const debug = await saveDebugArtifacts(page);
    throw new Error(`Cannot find TikTok login username field. Debug saved: ${debug.screenshotPath}, ${debug.htmlPath}`);
  }

  let passwordInput = await fillFirstEditable(
    [
      page.locator('input[autocomplete="current-password"]'),
      page.locator('input[name*="password" i]'),
      page.locator('input[type="password"]'),
      page.locator('input[placeholder*="密码"]'),
      page.locator('input[placeholder*="contraseña" i]'),
      page.locator('input[placeholder*="password" i]'),
      page.locator('input[placeholder*="Password" i]'),
    ],
    loginPassword,
  );

  if (!passwordInput) {
    await clickLocator(
      page.getByRole("button", { name: /下一步|继续|Next|Continue/i }),
      3000,
    ).catch(() => false);
    await page.waitForTimeout(1500);
    passwordInput = await fillFirstEditable(
      [
        page.locator('input[autocomplete="current-password"]'),
        page.locator('input[name*="password" i]'),
        page.locator('input[type="password"]'),
        page.locator('input[placeholder*="密码"]'),
        page.locator('input[placeholder*="contraseña" i]'),
        page.locator('input[placeholder*="password" i]'),
        page.locator('input[placeholder*="Password" i]'),
      ],
      loginPassword,
    );
  }

  if (!passwordInput) {
    const debug = await saveDebugArtifacts(page);
    throw new Error(`Cannot find TikTok login password field. Debug saved: ${debug.screenshotPath}, ${debug.htmlPath}`);
  }

  const submitted = await clickLocator(
    page.getByRole("button", { name: /登录|Log in|Sign in|Continue|继续|Iniciar sesión|Continuar/i }),
    5000,
  );

  if (!submitted) {
    await passwordInput.press("Enter").catch(() => {});
  }

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await page.waitForTimeout(2500);

    if (await pageNeedsHumanVerification(page)) {
      const debug = await saveDebugArtifacts(page);
      throw new Error(
        `TikTok requires captcha or two-step verification. Debug saved: ${debug.screenshotPath}, ${debug.htmlPath}`,
      );
    }

    if (!isLoginUrl(page.url()) && !(await pageLooksLoggedOut(page))) {
      return;
    }
  }

  const debug = await saveDebugArtifacts(page);
  throw new Error(`TikTok login did not complete. Debug saved: ${debug.screenshotPath}, ${debug.htmlPath}`);
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

const hasStorageState = await fileExists(statePath);

if (!userDataDir && !hasStorageState && !hasLoginCredentials) {
  throw new Error(
    `Missing TikTok storage state or login credentials. Set TIKTOK_STORAGE_STATE_PATH, or set TIKTOK_LOGIN_USERNAME/TIKTOK_LOGIN_PASSWORD.`,
  );
}

await mkdir(path.dirname(outputPath), { recursive: true });
await mkdir(downloadDir, { recursive: true });

const contextOptions = {
  acceptDownloads: true,
  downloadsPath: downloadDir,
  viewport: { width: 1440, height: 1000 },
};
const browser = userDataDir ? null : await chromium.launch({ channel, headless });
const context = userDataDir
  ? await chromium.launchPersistentContext(userDataDir, {
      ...contextOptions,
      channel,
      headless,
    })
  : await browser.newContext({
      ...contextOptions,
      ...(hasStorageState ? { storageState: JSON.parse(await readFile(statePath, "utf8")) } : {}),
    });
const page = await context.newPage();

try {
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});

  if (await pageLooksLoggedOut(page)) {
    if (!hasLoginCredentials) {
      throw new Error(
        "TikTok session is logged out or expired. Refresh TIKTOK_STORAGE_STATE_B64 or set TIKTOK_LOGIN_USERNAME/TIKTOK_LOGIN_PASSWORD.",
      );
    }

    await loginWithCredentials(page);
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});

    if (await pageLooksLoggedOut(page)) {
      const debug = await saveDebugArtifacts(page);
      throw new Error(`TikTok login completed but target page is still logged out. Debug saved: ${debug.screenshotPath}, ${debug.htmlPath}`);
    }

    await mkdir(path.dirname(statePath), { recursive: true });
    await context.storageState({ path: statePath }).catch(() => {});
  }

  const exportReady = await waitForExportButton(page);

  if (!exportReady) {
    const debug = await saveDebugArtifacts(page);
    throw new Error(`Cannot find TikTok export button. Debug saved: ${debug.screenshotPath}, ${debug.htmlPath}`);
  }

  let download = await waitForDownloadAfter(async () => {
    const clicked = await clickExport(page);

    if (!clicked) {
      const debug = await saveDebugArtifacts(page);
      throw new Error(`Cannot find TikTok export button. Debug saved: ${debug.screenshotPath}, ${debug.htmlPath}`);
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
  await browser?.close();
}
