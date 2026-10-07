import { existsSync, lstatSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const gitPath = resolve(projectRoot, ".git");

if (process.env.CI || !existsSync(gitPath)) {
  process.exit(0);
}

const gitEntry = lstatSync(gitPath);
if (!gitEntry.isDirectory() && !gitEntry.isFile()) {
  process.exit(0);
}

const result = spawnSync("git", ["config", "core.hooksPath", ".githooks"], {
  cwd: projectRoot,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(`Unable to configure Git hooks: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
