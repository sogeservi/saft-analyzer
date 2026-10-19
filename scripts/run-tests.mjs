import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { build } from "esbuild";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const buildDir = await mkdtemp(join(tmpdir(), "saft-analyzer-tests-"));

try {
  const testModules = [
    { name: "format", path: ["src", "lib", "format.ts"] },
    { name: "financial-activity", path: ["src", "lib", "financial-activity.ts"] },
  ];

  for (const { name, path } of testModules) {
    const source = await readFile(join(projectRoot, ...path), "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    });
    await writeFile(join(buildDir, `${name}.cjs`), output.outputText);
  }

  for (const [name, path] of [
    ["accounting-basis", "src/lib/validators/accounting-basis.ts"],
    ["sales-invoices", "src/lib/validators/sales-invoices.ts"],
    ["process-saft", "src/lib/analysis/process-saft.ts"],
    ["analyze-file", "src/lib/analysis/analyze-file.ts"],
    ["analysis-worker", "src/lib/workers/analysis.worker.ts"],
  ]) {
    await build({
      entryPoints: [join(projectRoot, path)],
      outfile: join(buildDir, `${name}.cjs`),
      bundle: true,
      platform: name === "analysis-worker" ? "browser" : "node",
      format: name === "analysis-worker" ? "esm" : "cjs",
      target: name === "analysis-worker" ? "es2022" : "node24",
    });
  }

  const result = spawnSync(process.execPath, ["--test"], {
    cwd: projectRoot,
    env: { ...process.env, SAFT_TEST_BUILD_DIR: buildDir },
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`Unable to run tests: ${result.error.message}`);
    process.exitCode = 1;
  } else {
    process.exitCode = result.status ?? 1;
  }
} finally {
  await rm(buildDir, { recursive: true, force: true });
}
