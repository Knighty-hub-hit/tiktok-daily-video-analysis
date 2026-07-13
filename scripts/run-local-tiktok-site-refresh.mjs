import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const DEFAULT_SPREADSHEET_TOKEN = "XBkGskwtShOA8DtFyB4cDgxVnTd";
const DEFAULT_SHEET_ID = "hlCeKL";
const DEFAULT_CHAT_ID = "oc_3e94266549326ee77142bc96b9c50078";
const DEFAULT_MIAODA_APP_ID = "app_179t4tka49p";
const DEFAULT_MIAODA_SITE_URL = "https://xinchimcn.aiforce.cloud/app/app_179t4tka49p";

const reportPath = process.argv[2] || process.env.TIKTOK_REPORT_INPUT;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: options.input ? ["pipe", "pipe", "pipe"] : ["ignore", "pipe", "pipe"],
    maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
    input: options.input,
    env: {
      ...process.env,
      LARKSUITE_CLI_NO_SKILLS_NOTIFIER: "1",
      LARKSUITE_CLI_NO_UPDATE_NOTIFIER: "1",
      ...options.env,
    },
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with ${result.status}`);
  }

  return result;
}

async function parseJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function latestDateFromPrepared(prepared) {
  const dateIndex = prepared.headers.indexOf("视频发布日期");

  return prepared.rows
    .map((row) => row[dateIndex])
    .filter(Boolean)
    .sort()
    .at(-1);
}

async function main() {
  if (!reportPath) {
    throw new Error("Usage: node scripts/run-local-tiktok-site-refresh.mjs <TikTok Excel .xlsx>");
  }

  const absoluteReportPath = path.resolve(reportPath);
  const reportStat = await stat(absoluteReportPath);

  if (reportStat.size <= 0) {
    throw new Error(`TikTok report is empty: ${absoluteReportPath}`);
  }

  await mkdir("data/exports", { recursive: true });

  const preparedPath = "data/tiktok-feishu-latest.json";
  const mergedCsvPath = "/tmp/tiktok-feishu.csv";
  const spreadsheetToken = process.env.FEISHU_SPREADSHEET_TOKEN || DEFAULT_SPREADSHEET_TOKEN;
  const sheetId = process.env.FEISHU_SHEET_ID || DEFAULT_SHEET_ID;
  const chatId = process.env.LARK_TARGET_CHAT_ID || process.env.FEISHU_TARGET_CHAT_ID || DEFAULT_CHAT_ID;
  const miaodaAppId = process.env.MIAODA_APP_ID || DEFAULT_MIAODA_APP_ID;
  const miaodaSiteUrl = process.env.SITE_PUBLIC_URL || process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_MIAODA_SITE_URL;
  const importMode = process.env.TIKTOK_IMPORT_MODE || "rolling-days";
  const rollingLookbackDays = process.env.TIKTOK_ROLLING_LOOKBACK_DAYS || "3";

  run("npm", ["run", "feishu:prepare", "--", absoluteReportPath, preparedPath], {
    env: {
      TIKTOK_IMPORT_MODE: importMode,
      TIKTOK_ROLLING_LOOKBACK_DAYS: rollingLookbackDays,
    },
  });

  const prepared = await parseJsonFile(preparedPath);
  const latestDate = latestDateFromPrepared(prepared);

  run("npm", ["run", "feishu:merge-csv", "--", preparedPath, mergedCsvPath], {
    env: {
      FEISHU_SPREADSHEET_TOKEN: spreadsheetToken,
      FEISHU_SHEET_ID: sheetId,
    },
  });

  const mergedCsv = await readFile(mergedCsvPath, "utf8");
  run(
    "lark-cli",
    [
      "sheets",
      "+csv-put",
      "--spreadsheet-token",
      spreadsheetToken,
      "--sheet-id",
      sheetId,
      "--start-cell",
      "A1",
      "--csv",
      "-",
      "--as",
      "bot",
    ],
    { input: mergedCsv },
  );

  run("npm", ["run", "feishu:import"], {
    env: {
      FEISHU_READ_MODE: "lark-cli",
      FEISHU_SPREADSHEET_TOKEN: spreadsheetToken,
      FEISHU_SHEET_ID: sheetId,
    },
  });
  run("npm", ["run", "data:validate"]);
  run("npm", ["run", "miaoda:build"]);
  run("npm", ["run", "miaoda:prepare"]);

  if (process.env.SKIP_MIAODA_PUBLISH !== "1") {
    run("lark-cli", [
      "apps",
      "+access-scope-set",
      "--app-id",
      miaodaAppId,
      "--scope",
      "specific",
      "--targets",
      JSON.stringify([{ type: "chat", id: chatId }]),
      "--as",
      "user",
    ]);
    run("lark-cli", ["apps", "+html-publish", "--app-id", miaodaAppId, "--path", "./out", "--as", "user"]);
  }

  if (process.env.SKIP_FEISHU_NOTIFY !== "1") {
    run("npm", ["run", "feishu:notify"], {
      env: {
        FEISHU_NOTIFY_USE_LARK_CLI: "1",
        LARK_TARGET_CHAT_ID: chatId,
        SITE_PUBLIC_URL: miaodaSiteUrl,
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        reportPath: absoluteReportPath,
        latestDate,
        incomingRows: prepared.rows.length,
        publishedUrl: process.env.SKIP_MIAODA_PUBLISH === "1" ? null : miaodaSiteUrl,
      },
      null,
      2,
    ),
  );
}

await main();
