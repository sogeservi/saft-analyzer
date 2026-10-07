import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

test("copies the npm prepare script before installing dependencies in Docker", async () => {
  // #given
  const dockerfile = await readFile(join(projectRoot, "Dockerfile"), "utf8");

  // #when
  const depsStage = dockerfile.split("FROM base AS builder")[0];
  const installerCopy = depsStage.indexOf("COPY scripts/install-git-hooks.mjs");
  const npmInstall = depsStage.indexOf("RUN npm ci");

  // #then
  assert.ok(installerCopy >= 0 && installerCopy < npmInstall);
});
