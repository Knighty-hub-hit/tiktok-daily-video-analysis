import { readFile, writeFile } from "node:fs/promises";

const inputPath = process.argv[2] ?? "data/site-videos.json";
const outputPath = process.argv[3] ?? "data/site-dashboard.json";

const DASHBOARD_FIELDS = [
  "id",
  "date",
  "creator",
  "title",
  "product",
  "category",
  "audience",
  "language",
  "link",
  "views",
  "likes",
  "comments",
  "orders",
  "soldItems",
  "revenue",
  "price",
  "ctr",
  "rpm",
  "commission",
  "source",
];

function pickDashboardRecord(record) {
  const picked = {};

  for (const field of DASHBOARD_FIELDS) {
    if (record[field] !== undefined) {
      picked[field] = record[field];
    }
  }

  return picked;
}

const source = JSON.parse(await readFile(inputPath, "utf8"));
const records = Array.isArray(source.records) ? source.records.map(pickDashboardRecord) : [];
const dashboard = {
  generatedAt: source.generatedAt ?? new Date().toISOString(),
  sourceFile: source.sourceFile ?? inputPath,
  sourceHeaders: source.sourceHeaders ?? {},
  julyStart: source.julyStart ?? "2026-07-01",
  count: records.length,
  records,
};

await writeFile(outputPath, `${JSON.stringify(dashboard, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      ok: true,
      inputPath,
      outputPath,
      count: records.length,
    },
    null,
    2,
  ),
);
