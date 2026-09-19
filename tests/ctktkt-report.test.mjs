import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateCtktktSummary, previousIsoDate } from "../lib/ctktkt-report.ts";

function coalMeters(entries, columns, totals) {
  for (const column of columns) for (let row = 16; row <= 27; row += 1) entries[`${column}${row}`] = "0";
  entries[`${columns[0]}16`] = String(totals[0]);
  entries[`${columns[1]}16`] = String(totals[1]);
  entries[`${columns[2]}16`] = String(totals[2]);
}

test("CTKTKT uses full-precision meter differences and the 8.5% moisture basis", () => {
  const previous = { AB8: "1000", AB9: "900", AB10: "100", AB11: "50", AL8: "2000", AL9: "1800", AL10: "200", AL11: "100" };
  const current = { AB8: "1100", AB9: "990", AB10: "106", AB11: "54", AL8: "2100", AL9: "1890", AL10: "206", AL11: "104" };
  coalMeters(previous, ["X", "Z", "AB"], [0, 0, 0]);
  coalMeters(previous, ["AH", "AJ", "AL"], [0, 0, 0]);
  coalMeters(current, ["X", "Z", "AB"], [10, 20, 30]);
  coalMeters(current, ["AH", "AJ", "AL"], [10, 20, 30]);
  for (const row of [87, 88, 89, 90, 91, 92]) { current[`AJ${row}`] = "8.5"; current[`AK${row}`] = "5000"; }

  const result = calculateCtktktSummary(current, previous);
  assert.equal(result.s1.grossMwh, 100);
  assert.equal(result.s1.netMwh, 90);
  assert.equal(result.s1.auxiliaryMwh, 10);
  assert.equal(result.s1.adjustedCoalTonnes, 30);
  assert.equal(result.s1.netCoalRate, 1000 / 3);
  assert.ok(Math.abs(result.s1.netHeatRate - 6384.87) < 0.000001);
  assert.equal(result.plant.grossMwh, 200);
  assert.equal(result.plant.netMwh, 180);
});

test("CTKTKT does not invent results when previous-day readings are missing", () => {
  const result = calculateCtktktSummary({ AB8: "100" });
  assert.equal(result.s1.grossMwh, null);
  assert.equal(result.plant.netHeatRate, null);
});

test("previous operating date crosses month and leap-year boundaries", () => {
  assert.equal(previousIsoDate("2026-09-01"), "2026-08-31");
  assert.equal(previousIsoDate("2028-03-01"), "2028-02-29");
});
