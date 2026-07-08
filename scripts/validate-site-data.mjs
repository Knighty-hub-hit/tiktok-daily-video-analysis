import { access, readFile } from "node:fs/promises";
import path from "node:path";

const dataPath = process.argv[2] ?? "data/site-videos.json";
const errors = [];
const warnings = [];

function pushError(message) {
  errors.push(message);
}

function pushWarning(message) {
  warnings.push(message);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function publicAssetPath(assetPath) {
  if (!hasText(assetPath) || !assetPath.startsWith("/")) {
    return null;
  }

  return path.join("public", assetPath.slice(1));
}

async function assetExists(assetPath) {
  const localPath = publicAssetPath(assetPath);

  if (!localPath) {
    return false;
  }

  try {
    await access(localPath);
    return true;
  } catch {
    return false;
  }
}

function summarizeByDate(records) {
  const byDate = new Map();

  for (const record of records) {
    const summary = byDate.get(record.date) ?? {
      count: 0,
      orders: 0,
      revenue: 0,
      views: 0,
    };

    summary.count += 1;
    summary.orders += record.orders ?? 0;
    summary.revenue += record.revenue ?? 0;
    summary.views += record.views ?? 0;
    byDate.set(record.date, summary);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, summary]) => ({ date, ...summary }));
}

const raw = await readFile(dataPath, "utf8");
const data = JSON.parse(raw);

if (!isObject(data)) {
  pushError(`${dataPath} must contain a JSON object.`);
}

const records = Array.isArray(data.records) ? data.records : [];

if (!Array.isArray(data.records)) {
  pushError("records must be an array.");
}

if (data.count !== undefined && data.count !== records.length) {
  pushError(`count is ${data.count}, but records length is ${records.length}.`);
}

if (records.length === 0) {
  pushError("records is empty.");
}

const seenIds = new Map();
const seenLinks = new Map();

for (const [index, record] of records.entries()) {
  const label = `records[${index}]`;

  if (!isObject(record)) {
    pushError(`${label} must be an object.`);
    continue;
  }

  for (const field of ["id", "date", "creator", "title", "link", "cover"]) {
    if (!hasText(record[field])) {
      pushError(`${label}.${field} is required.`);
    }
  }

  if (hasText(record.date) && !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) {
    pushError(`${label}.date must use YYYY-MM-DD.`);
  }

  if (hasText(record.link) && !record.link.includes("tiktok.com/")) {
    pushError(`${label}.link must be a TikTok URL.`);
  }

  for (const field of ["views", "likes", "orders", "revenue", "price"]) {
    if (!hasNumber(record[field])) {
      pushError(`${label}.${field} must be a number.`);
    }
  }

  for (const field of ["comments", "soldItems", "ctr", "rpm", "commission"]) {
    if (record[field] !== undefined && !hasNumber(record[field])) {
      pushError(`${label}.${field} must be a number when present.`);
    }
  }

  if (hasText(record.id)) {
    if (seenIds.has(record.id)) {
      pushError(`${label}.id duplicates records[${seenIds.get(record.id)}].id.`);
    }

    seenIds.set(record.id, index);
  }

  if (hasText(record.link)) {
    if (seenLinks.has(record.link)) {
      pushError(`${label}.link duplicates records[${seenLinks.get(record.link)}].link.`);
    }

    seenLinks.set(record.link, index);
  }

  if (!(await assetExists(record.cover))) {
    pushError(`${label}.cover does not exist: ${record.cover}`);
  }

  if (record.videoReady && !hasText(record.videoFile)) {
    pushError(`${label}.videoReady is true but videoFile is missing.`);
  }

  if (record.videoReady && hasText(record.videoFile) && !(await assetExists(record.videoFile))) {
    pushError(`${label}.videoFile does not exist: ${record.videoFile}`);
  }

  if (hasText(record.transcriptFile) && !(await assetExists(record.transcriptFile))) {
    pushWarning(`${label}.transcriptFile is listed but missing: ${record.transcriptFile}`);
  }

  if (!Array.isArray(record.frames) || record.frames.length === 0) {
    pushError(`${label}.frames must contain at least one frame.`);
  } else {
    for (const [frameIndex, frame] of record.frames.entries()) {
      const frameLabel = `${label}.frames[${frameIndex}]`;

      for (const field of ["time", "title", "note", "image"]) {
        if (!hasText(frame?.[field])) {
          pushError(`${frameLabel}.${field} is required.`);
        }
      }

      if (hasText(frame?.image) && !(await assetExists(frame.image))) {
        pushError(`${frameLabel}.image does not exist: ${frame.image}`);
      }
    }
  }

  if (!Array.isArray(record.script) || record.script.length === 0) {
    pushWarning(`${label}.script is empty.`);
  }

  if (!isObject(record.breakdown)) {
    pushError(`${label}.breakdown is required.`);
  } else {
    for (const field of ["hookType", "hook", "sellingPoint", "cta", "reusable"]) {
      if (!hasText(record.breakdown[field])) {
        pushError(`${label}.breakdown.${field} is required.`);
      }
    }
  }

  if (!Array.isArray(record.reasons) || record.reasons.length === 0) {
    pushWarning(`${label}.reasons is empty.`);
  }
}

const summary = {
  dataPath,
  generatedAt: data.generatedAt ?? null,
  sourceFile: data.sourceFile ?? null,
  count: records.length,
  dates: summarizeByDate(records),
  warnings,
};

if (errors.length > 0) {
  console.error(JSON.stringify({ ok: false, errors, ...summary }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, ...summary }, null, 2));
