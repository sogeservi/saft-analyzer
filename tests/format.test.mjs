import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";
import test from "node:test";

const requireFromBuild = createRequire(import.meta.url);
const { formatDuration } = requireFromBuild(
  join(process.env.SAFT_TEST_BUILD_DIR, "format.cjs"),
);

test("formats sub-second durations as milliseconds", () => {
  // #given
  const duration = 14;

  // #when
  const result = formatDuration(duration);

  // #then
  assert.equal(result, "14 milissegundos");
});

test("formats a one-second duration with the singular label", () => {
  // #given
  const duration = 1000;

  // #when
  const result = formatDuration(duration);

  // #then
  assert.equal(result, "1 segundo");
});

test("formats a duration of one minute without a seconds remainder", () => {
  // #given
  const duration = 60_000;

  // #when
  const result = formatDuration(duration);

  // #then
  assert.equal(result, "1 minuto");
});
