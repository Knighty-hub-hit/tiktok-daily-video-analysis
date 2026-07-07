import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = process.argv[2];
const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const sheetInfo = await workbook.inspect({ kind: "sheet", include: "id,name", maxChars: 3000 });
const sheet = workbook.worksheets.getItemAt(0);
const used = sheet.getUsedRange(true);
const values = used.values;
const headers = values[0].map((value) => String(value ?? "").trim());
const dateIndex = headers.indexOf("视频发布日期");
const linkIndex = headers.indexOf("视频链接");
const creatorIndex = headers.indexOf("达人用户名");
if ([dateIndex, linkIndex, creatorIndex].some((index) => index < 0)) {
  throw new Error(`Missing required columns. Headers: ${headers.join(" | ")}`);
}
const rows = values.slice(1).map((row, sourceIndex) => ({
  sourceRow: sourceIndex + 2,
  date: row[dateIndex] instanceof Date
    ? row[dateIndex].toISOString().slice(0, 10)
    : String(row[dateIndex] ?? "").trim().slice(0, 10),
  link: String(row[linkIndex] ?? "").trim(),
  creator: String(row[creatorIndex] ?? "").trim(),
})).filter((row) => row.date && row.link);
const latestDate = rows.reduce((max, row) => row.date > max ? row.date : max, "");
const latestRows = rows.filter((row) => row.date === latestDate);
console.log(JSON.stringify({
  sheetInfo: sheetInfo.ndjson,
  headers,
  totalDataRows: rows.length,
  latestDate,
  latestRows,
}, null, 2));
