import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";
import test from "node:test";

const requireFromBuild = createRequire(import.meta.url);
const { groupFinancialActivity } = requireFromBuild(
  join(process.env.SAFT_TEST_BUILD_DIR, "financial-activity.cjs"),
);

test("groups short date ranges by day and keeps all amounts and document counts", () => {
  // #given
  const days = [
    { date: "2026-04-02", grossTotal: 25, documentCount: 2 },
    { date: "2026-04-01", grossTotal: 10, documentCount: 1 },
  ];

  // #when
  const result = groupFinancialActivity(days);

  // #then
  assert.deepEqual(
    { period: result.period, totals: result.buckets.map(({ grossTotal, documentCount }) => [grossTotal, documentCount]) },
    { period: "day", totals: [[10, 1], [25, 2]] },
  );
});

test("selects weekly buckets for a range longer than 45 days", () => {
  // #given
  const days = [
    { date: "2026-01-01", grossTotal: 5, documentCount: 1 },
    { date: "2026-03-01", grossTotal: 7, documentCount: 1 },
  ];

  // #when
  const result = groupFinancialActivity(days);

  // #then
  assert.equal(result.period, "week");
});

test("returns no buckets when all date values are invalid", () => {
  // #given
  const days = [{ date: "not-a-date", grossTotal: 5, documentCount: 1 }];

  // #when
  const result = groupFinancialActivity(days);

  // #then
  assert.deepEqual(result.buckets, []);
});
