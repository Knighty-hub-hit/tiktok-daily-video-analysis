import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { mergeRows, loadPreparedRows } from "./sync-feishu-sheet-from-tiktok-report.mjs";

const inputPath = process.argv[2] ?? "data/tiktok-feishu-latest.json";
const outputPath = process.argv[3] ?? "/tmp/tiktok-feishu.csv";
const spreadsheetToken = process.env.FEISHU_SPREADSHEET_TOKEN || "XBkGskwtShOA8DtFyB4cDgxVnTd";
const sheetId = process.env.FEISHU_SHEET_ID || "hlCeKL";
const range = process.env.FEISHU_READ_RANGE || "A1:R5000";
const asIdentity = process.env.FEISHU_CLI_AS || "bot";

function runLarkCli(args) {
  const result = spawnSync("lark-cli", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      LARKSUITE_CLI_NO_SKILLS_NOTIFIER: "1",
      LARKSUITE_CLI_NO_UPDATE_NOTIFIER: "1",
    },
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `lark-cli exited with ${result.status}`);
  }

  return JSON.parse(result.stdout);
}

function splitCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (quoted && char === '"' && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === ",") {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }

  cells.push(cell);
  return cells;
}

function parseAnnotatedCsv(annotatedCsv) {
  return String(annotatedCsv ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\[row=\d+\]\s*/, ""))
    .filter((line) => line.trim())
    .map(splitCsvLine);
}

function csvCell(value) {
  const text = String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function toCsv(values) {
  return `${values.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

const envelope = runLarkCli([
  "sheets",
  "+csv-get",
  "--spreadsheet-token",
  spreadsheetToken,
  "--sheet-id",
  sheetId,
  "--range",
  range,
  "--as",
  asIdentity,
]);

const existingValues = parseAnnotatedCsv(envelope.data?.annotated_csv);
const { headers, rows } = await loadPreparedRows(inputPath);
const mergedValues = mergeRows({
  existingValues,
  incomingRows: rows,
  targetHeaders: headers,
});
const columnCount = headers.length;
const blankRow = Array.from({ length: columnCount }, () => "");

while (mergedValues.length < existingValues.length) {
  mergedValues.push(blankRow);
}

await writeFile(outputPath, toCsv(mergedValues), "utf8");

const dateIndex = headers.indexOf("视频发布日期");
const latestDate = rows
  .map((row) => row[dateIndex])
  .filter(Boolean)
  .sort()
  .at(-1);

console.log(
  JSON.stringify(
    {
      ok: true,
      outputPath,
      incomingRows: rows.length,
      existingRows: Math.max(existingValues.length - 1, 0),
      mergedRows: mergedValues.filter((row) => row.some((cell) => String(cell ?? "").trim())).length - 1,
      latestDate,
    },
    null,
    2,
  ),
);
