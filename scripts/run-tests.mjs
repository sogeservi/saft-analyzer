import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const buildDir = await mkdtemp(join(tmpdir(), "saft-analyzer-tests-"));

try {
  const testModules = [
    { name: "format", path: ["src", "lib", "format.ts"] },
    { name: "financial-activity", path: ["src", "lib", "financial-activity.ts"] },
    { name: "client-ip", path: ["src", "lib", "server", "client-ip.ts"] },
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
