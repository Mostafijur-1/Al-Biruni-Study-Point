import assert from "node:assert/strict";
import test from "node:test";
import { REPORTING_SOURCE_LIMITS, readProjection } from "../lib/reporting/projection-service.ts";
import { REPORTING_QUERY_SHAPES } from "../lib/reporting/query-shapes.ts";

test("reporting metric catalog has finite source and staging latency budgets", () => {
  assert.deepEqual(Object.keys(REPORTING_QUERY_SHAPES).sort(), ["assessment-trend", "attendance-daily", "finance-monthly", "student-today", "teacher-today"]);
  for (const shape of Object.values(REPORTING_QUERY_SHAPES)) {
    assert.ok(Number.isFinite(shape.maximumRows) && shape.maximumRows > 0);
    assert.ok(Number.isFinite(shape.stagingP95BudgetMs) && shape.stagingP95BudgetMs > 0);
    assert.ok(shape.owner.length > 0 && shape.source.length > 0);
  }
  for (const limit of Object.values(REPORTING_SOURCE_LIMITS)) assert.ok(Number.isInteger(limit) && limit > 0 && limit <= 20_000);
});

test("projection reads default to the authoritative fallback", async () => {
  const previous = process.env.REPORTING_PROJECTIONS_ENABLED;
  delete process.env.REPORTING_PROJECTIONS_ENABLED;
  try {
    const result = await readProjection({ organizationId: "000000000000000000000001", branchId: "000000000000000000000002", projectionType: "finance-monthly", subjectKey: "scope", periodKey: "2026-08" });
    assert.equal(result, null);
  } finally {
    if (previous === undefined) delete process.env.REPORTING_PROJECTIONS_ENABLED;
    else process.env.REPORTING_PROJECTIONS_ENABLED = previous;
  }
});
