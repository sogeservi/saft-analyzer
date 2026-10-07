import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(projectRoot, "public/analysis.worker.js");

await mkdir(dirname(outputPath), { recursive: true });
await build({
  entryPoints: [resolve(projectRoot, "src/lib/workers/analysis.worker.ts")],
  outfile: outputPath,
  bundle: true,
  platform: "browser",
  format: "esm",
  target: "es2022",
  tsconfig: resolve(projectRoot, "tsconfig.json"),
  legalComments: "none",
});
