import test from "node:test";
import assert from "node:assert/strict";
import {
  CTKTKT_LINKED_DAILY_CODES,
  QLKT_DIRECT_DAILY_CODES,
  deriveDailyValuesFromCtktkt,
} from "../lib/daily-source-links.ts";

function fillRange(target, column, value) {
  for (let row = 16; row <= 27; row += 1) target[`${column}${row}`] = String(value);
}

test("monthly data derives duplicated production values from CTKTKT", () => {
  const previous = { AB13: "100", AB14: "20", AL13: "200", AL14: "40" };
  fillRange(previous, "AB", 0);
  fillRange(previous, "AL", 0);

  const current = {
    J157: "12100", K157: "11200", J158: "12200", K158: "11300", I36: "456.7",
  };
  fillRange(current, "X", 10);
  fillRange(current, "Z", 20);
  fillRange(current, "AB", 30);
  fillRange(current, "AH", 10);
  fillRange(current, "AJ", 20);
  fillRange(current, "AL", 30);
  for (const row of [87, 88, 89, 90, 91, 92]) {
    current[`AJ${row}`] = "10";
    current[`AK${row}`] = "5000";
  }
  current.AB13 = "160";
  current.AB14 = "32";
  current.AL13 = "260";
  current.AL14 = "52";

  const linked = deriveDailyValuesFromCtktkt(current, previous);
  assert.equal(linked.B, "12.1");
  assert.equal(linked.C, "11.2");
  assert.equal(linked.H, "12.2");
  assert.equal(linked.I, "11.3");
  assert.equal(linked.AE, "360");
  assert.equal(linked.AF, "360");
  assert.equal(linked.AT, "456.7");
  assert.equal(linked.X, "48.048");
  assert.ok(Number(linked.AJ) > 0);
});

test("daily HFO requires complete 24h readings for both units", () => {
  const previous = { AB13: "100", AB14: "20", AL13: "200", AL14: "40" };
  const current = { AB13: "160", AB14: "32", AL13: "260" };

  const linked = deriveDailyValuesFromCtktkt(current, previous);
  assert.equal(linked.X, undefined);
});

test("QLKT monthly synchronization excludes fields already linked from CTKTKT", () => {
  for (const code of CTKTKT_LINKED_DAILY_CODES) assert.equal(QLKT_DIRECT_DAILY_CODES.has(code), false, code);
  assert.deepEqual([...QLKT_DIRECT_DAILY_CODES], ["F", "L", "AR", "CC", "CD", "CS", "CT", "CU", "CV"]);
});
