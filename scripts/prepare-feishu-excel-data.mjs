import { spawnSync } from "node:child_process";

const result = spawnSync("python3", ["scripts/prepare-feishu-excel-data.py", ...process.argv.slice(2)], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
