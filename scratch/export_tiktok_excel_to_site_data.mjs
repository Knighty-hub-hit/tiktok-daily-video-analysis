import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
import { buildSiteDataFromRows, writeSiteData } from "../scripts/site-data-builder.mjs";

const inputPath = process.argv[2];
const outputPath = process.argv[3] ?? "data/site-videos.json";

if (!inputPath) {
  throw new Error("Usage: node scratch/export_tiktok_excel_to_site_data.mjs <xlsx> [output]");
}

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const sheet = workbook.worksheets.getItemAt(0);
const values = sheet.getUsedRange(true).values;
const headers = values[0].map((value) => String(value ?? "").trim());
const rows = values.slice(1).map((valuesRow, index) => {
  const row = Object.fromEntries(headers.map((header, headerIndex) => [header, valuesRow[headerIndex]]));
  row.__sourceRow = index + 2;
  return row;
});

const siteData = await buildSiteDataFromRows(rows, {
  outputPath,
  sourceHeaders: headers,
  sourceLabel: path.basename(inputPath),
});

await writeSiteData(outputPath, siteData);

console.log(
  JSON.stringify(
    {
      outputPath,
      sourceRows: rows.length,
      siteRecords: siteData.records.length,
      dates: Array.from(new Set(siteData.records.map((record) => record.date))).sort(),
      headers,
    },
    null,
    2,
  ),
);
