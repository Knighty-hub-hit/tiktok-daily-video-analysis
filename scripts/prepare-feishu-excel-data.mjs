import { writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeDate } from "./site-data-builder.mjs";

async function loadArtifactTool() {
  try {
    return await import("@oai/artifact-tool");
  } catch (error) {
    if (error?.code !== "ERR_MODULE_NOT_FOUND") {
      throw error;
    }

    const bundledPath = path.join(
      homedir(),
      ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs",
    );

    return import(pathToFileURL(bundledPath).href);
  }
}

const { FileBlob, SpreadsheetFile } = await loadArtifactTool();

const inputPath = process.argv[2];
const outputPath = process.argv[3];
const startDate = process.env.SITE_DATA_START_DATE ?? "2026-07-01";

if (!inputPath || !outputPath) {
  throw new Error(
    "Usage: node scripts/prepare-feishu-excel-data.mjs <input.xlsx> <output.csv|output.tsv>",
  );
}

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const sheet = workbook.worksheets.getItemAt(0);
const values = sheet.getUsedRange(true).values;

if (!values.length) {
  throw new Error("TikTok export is empty.");
}

const headers = values[0].map((value) => String(value ?? "").trim());
const dateIndex = headers.indexOf("视频发布日期");
const linkIndex = headers.indexOf("视频链接");

if (headers.length !== 18) {
  throw new Error(`TikTok export must contain exactly 18 columns; received ${headers.length}.`);
}

if (dateIndex < 0 || linkIndex < 0) {
  throw new Error("TikTok export must contain 视频发布日期 and 视频链接 columns.");
}

function cleanCell(value) {
  return String(value ?? "")
    .replace(/[\t\r\n]+/g, " ")
    .trim();
}

const rowsByLink = new Map();

for (const sourceRow of values.slice(1)) {
  const date = normalizeDate(sourceRow[dateIndex]);
  const link = cleanCell(sourceRow[linkIndex]);

  if (!date || date < startDate || !link.includes("tiktok.com/")) {
    continue;
  }

  const row = headers.map((_, index) => {
    if (index === dateIndex) {
      return date;
    }

    return cleanCell(sourceRow[index]);
  });

  rowsByLink.set(link, row);
}

const rows = Array.from(rowsByLink.values());

if (!rows.length) {
  throw new Error(`No TikTok rows found on or after ${startDate}.`);
}

const outputRows = [headers, ...rows];
const isCsv = path.extname(outputPath).toLowerCase() === ".csv";

function escapeCsvCell(value) {
  const text = String(value ?? "");

  if (!/[",\r\n]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

const output = isCsv
  ? outputRows.map((row) => row.map(escapeCsvCell).join(",")).join("\n")
  : outputRows.map((row) => row.join("\t")).join("\n");

await writeFile(outputPath, `${output}\n`, "utf8");

const dates = rows.map((row) => row[dateIndex]).sort();

console.log(
  JSON.stringify(
    {
      outputPath,
      columns: headers.length,
      rows: rows.length,
      format: isCsv ? "csv" : "tsv",
      startDate: dates[0],
      endDate: dates.at(-1),
    },
    null,
    2,
  ),
);
