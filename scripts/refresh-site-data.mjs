import { spawnSync } from "node:child_process";

const inputPath = process.argv[2];
const outputPath = process.argv[3] ?? "data/site-videos.json";

if (!inputPath) {
  console.error("Usage: npm run data:import -- <xlsx> [output]");
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(process.execPath, [
  "scratch/export_tiktok_excel_to_site_data.mjs",
  inputPath,
  outputPath,
]);

run(process.execPath, ["scripts/validate-site-data.mjs", outputPath]);
