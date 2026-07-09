import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { attachLocalMediaAssets, PENDING_COVER } from "./site-data-builder.mjs";

const dataPath = process.argv.find((arg) => arg.endsWith(".json")) ?? "data/site-videos.json";
const latestDateOnly = process.argv.includes("--latest-date");
const noFetch = process.argv.includes("--no-fetch") || process.env.TIKTOK_MEDIA_FETCH === "0";
const dryRun = process.argv.includes("--dry-run");
const limit = Number.parseInt(process.env.TIKTOK_MEDIA_ENRICH_LIMIT ?? "20", 10);

function hasPendingCover(record) {
  return !record.cover || record.cover === PENDING_COVER || record.cover === "/video-cover.png";
}

function latestDate(records) {
  return records
    .map((record) => record.date)
    .filter(Boolean)
    .sort()
    .at(-1);
}

function extensionFromContentType(contentType) {
  if (contentType.includes("png")) {
    return ".png";
  }

  if (contentType.includes("webp")) {
    return ".webp";
  }

  return ".jpg";
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "tiktok-daily-video-analysis/1.0 (+github-actions)",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function downloadImage(url, outputBasePath) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "tiktok-daily-video-analysis/1.0 (+github-actions)",
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`thumbnail HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.startsWith("image/")) {
    throw new Error(`thumbnail is not an image: ${contentType || "unknown content-type"}`);
  }

  const extension = extensionFromContentType(contentType);
  const outputPath = `${outputBasePath}${extension}`;
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
  return outputPath;
}

async function fetchTikTokCover(record) {
  const oembed = await fetchJson(`https://www.tiktok.com/oembed?url=${encodeURIComponent(record.link)}`);

  if (!oembed.thumbnail_url) {
    throw new Error("TikTok oEmbed did not return thumbnail_url");
  }

  const localPath = await downloadImage(oembed.thumbnail_url, path.join("public", "covers", record.id));
  return `/${path.relative("public", localPath).split(path.sep).join("/")}`;
}

const data = JSON.parse(await readFile(dataPath, "utf8"));
const records = Array.isArray(data.records) ? data.records : [];
const targetDate = latestDateOnly ? latestDate(records) : "";
const warnings = [];
let downloaded = 0;
let reconciled = 0;
let skipped = 0;

for (const record of records) {
  const before = JSON.stringify({
    cover: record.cover,
    frames: record.frames,
    script: record.script,
    mediaStatus: record.mediaStatus,
  });
  const enriched = await attachLocalMediaAssets(record);
  Object.assign(record, enriched);
  const after = JSON.stringify({
    cover: record.cover,
    frames: record.frames,
    script: record.script,
    mediaStatus: record.mediaStatus,
  });

  if (before !== after) {
    reconciled += 1;
  }
}

const targets = records
  .filter((record) => (!targetDate || record.date === targetDate) && hasPendingCover(record))
  .slice(0, Math.max(0, limit));

if (!noFetch) {
  for (const record of targets) {
    try {
      if (dryRun) {
        skipped += 1;
        continue;
      }

      const cover = await fetchTikTokCover(record);
      Object.assign(record, await attachLocalMediaAssets({ ...record, cover }));
      downloaded += 1;
    } catch (error) {
      warnings.push(`${record.id}: ${error.message}`);
    }
  }
} else {
  skipped = targets.length;
}

data.generatedAt = new Date().toISOString();
data.count = records.length;

if (!dryRun) {
  await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      dataPath,
      latestDate: targetDate || latestDate(records),
      latestDateOnly,
      noFetch,
      dryRun,
      reconciled,
      targets: targets.length,
      downloaded,
      skipped,
      warnings,
    },
    null,
    2,
  ),
);
