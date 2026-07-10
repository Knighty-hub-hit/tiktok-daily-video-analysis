import { access, readdir, stat } from "node:fs/promises";
import path from "node:path";

const MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;
const outDir = process.argv[2] ?? "out";

async function walkFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

async function getDirectorySize(directory) {
  const files = await walkFiles(directory);
  let total = 0;

  for (const file of files) {
    total += (await stat(file)).size;
  }

  return { files, total };
}

await access(path.join(outDir, "index.html"));

const { files, total } = await getDirectorySize(outDir);

if (total > MAX_UNCOMPRESSED_BYTES) {
  throw new Error(`Miaoda publish directory is ${total} bytes, over the ${MAX_UNCOMPRESSED_BYTES} byte limit.`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      outDir,
      files: files.length,
      totalMB: Number((total / 1024 / 1024).toFixed(2)),
      mode: "next-static",
    },
    null,
    2,
  ),
);
