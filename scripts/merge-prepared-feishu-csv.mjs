import { readFile, writeFile } from "node:fs/promises";

const [currentCsvPath, preparedJsonPath, outputCsvPath] = process.argv.slice(2);

if (!currentCsvPath || !preparedJsonPath || !outputCsvPath) {
  throw new Error(
    "Usage: node scripts/merge-prepared-feishu-csv.mjs <current.csv> <prepared.json> <output.csv>",
  );
}

function stripRowPrefix(line) {
  return line.replace(/^\[row=\d+\]\s*/, "");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted && char === '"' && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && char === ",") {
      row.push(cell);
      cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((value) => String(value ?? "").trim()));
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function videoKey(row, headers) {
  const linkIndex = headers.indexOf("视频链接");
  const link = String(row[linkIndex] ?? "").trim();
  const videoId = link.match(/\/video\/(\d+)/)?.[1];
  return videoId ? `video:${videoId}` : "";
}

const currentText = await readFile(currentCsvPath, "utf8");
const prepared = JSON.parse(await readFile(preparedJsonPath, "utf8"));
const currentRows = parseCsv(currentText.split(/\r?\n/).map(stripRowPrefix).join("\n"));

if (currentRows.length === 0) {
  throw new Error("Current Feishu CSV is empty.");
}

const headers = currentRows[0];
const preparedHeaders = prepared.headers ?? [];

if (headers.join("\u0000") !== preparedHeaders.join("\u0000")) {
  throw new Error("Prepared headers do not match current Feishu headers.");
}

const rows = currentRows.slice(1);
const indexByKey = new Map();

rows.forEach((row, index) => {
  const key = videoKey(row, headers);
  if (key) {
    indexByKey.set(key, index);
  }
});

let updated = 0;
let inserted = 0;

for (const preparedRow of prepared.rows ?? []) {
  const values = preparedRow.values ?? preparedRow;
  const key = videoKey(values, headers);

  if (!key) {
    continue;
  }

  if (indexByKey.has(key)) {
    rows[indexByKey.get(key)] = values;
    updated += 1;
  } else {
    indexByKey.set(key, rows.length);
    rows.push(values);
    inserted += 1;
  }
}

await writeFile(outputCsvPath, toCsv([headers, ...rows]), "utf8");

const dateIndex = headers.indexOf("视频发布日期");
const counts = rows.reduce((acc, row) => {
  const date = row[dateIndex];
  acc[date] = (acc[date] ?? 0) + 1;
  return acc;
}, {});

console.log(
  JSON.stringify(
    {
      inputRows: currentRows.length - 1,
      preparedRows: prepared.rows?.length ?? 0,
      outputRows: rows.length,
      updated,
      inserted,
      dates: Object.entries(counts).sort(),
    },
    null,
    2,
  ),
);
