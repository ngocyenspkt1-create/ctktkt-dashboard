import test from "node:test";
import assert from "node:assert/strict";
import {
  CTKTKT_LINKED_DAILY_CODES,
  QLKT_DIRECT_DAILY_CODES,
  deriveDailyValuesFromCtktkt,
  mergeDailyInputsWithCtktkt,
} from "../lib/daily-source-links.ts";

function fillRange(target, column, value) {
  for (let row = 16; row <= 27; row += 1) target[`${column}${row}`] = String(value);
}

test("monthly data derives duplicated production values from CTKTKT", () => {
  const previous = { AB13: "100", AB14: "20", AL13: "200", AL14: "40", N81: "103.84", N82: "479.43" };
  fillRange(previous, "AB", 0);
  fillRange(previous, "AL", 0);

  const current = {
    J157: "12100", K157: "11200", J158: "12200", K158: "11300", I36: "456.7",
    N81: "111.84", N82: "486.25", P72: "42.21", P73: "117.891", P74: "141.595", Q181: "10460.9417",
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
  assert.ok(Number(linked.AE_ADJ) > 0);
  assert.ok(Number(linked.AF_ADJ) > 0);
  assert.equal(linked.AT, "456.7");
  assert.equal(linked.X, "48.048");
  assert.equal(linked.BQ, "8");
  assert.equal(linked.BR, "6.82");
  assert.equal(linked.BN, "18.506");
  assert.equal(linked.CN, "42.21");
  assert.equal(linked.CJ, "10");
  assert.equal(linked.Q181, "10460.9417");
  assert.ok(Number(linked.AJ) > 0);
});

test("daily HFO requires complete 24h readings for both units", () => {
  const previous = { AB13: "100", AB14: "20", AL13: "200", AL14: "40" };
  const current = { AB13: "160", AB14: "32", AL13: "260" };

  const linked = deriveDailyValuesFromCtktkt(current, previous);
  assert.equal(linked.X, undefined);
});

test("daily HFO cannot be negative when return-meter drift exceeds supply", () => {
  const previous = { AB13: "1618075.8", AB14: "1595617.6", AL13: "40984097.7", AL14: "875373788.5" };
  const current = { AB13: "1618473.1", AB14: "1596017", AL13: "41337029", AL14: "875726692" };

  const linked = deriveDailyValuesFromCtktkt(current, previous);
  assert.equal(linked.X, "0");
});

test("QLKT monthly synchronization excludes fields already linked from CTKTKT", () => {
  for (const code of CTKTKT_LINKED_DAILY_CODES) assert.equal(QLKT_DIRECT_DAILY_CODES.has(code), false, code);
  assert.deepEqual([...QLKT_DIRECT_DAILY_CODES], ["F", "L", "AR", "CC", "CD", "CS", "CT", "CU", "CV"]);
  assert.equal(CTKTKT_LINKED_DAILY_CODES.has("BQ"), true);
  assert.equal(CTKTKT_LINKED_DAILY_CODES.has("BR"), true);
  assert.equal(CTKTKT_LINKED_DAILY_CODES.has("BN"), true);
  assert.equal(CTKTKT_LINKED_DAILY_CODES.has("CN"), true);
  assert.equal(CTKTKT_LINKED_DAILY_CODES.has("CJ"), true);
  assert.equal(CTKTKT_LINKED_DAILY_CODES.has("Q181"), true);
  assert.equal(CTKTKT_LINKED_DAILY_CODES.has("AE_ADJ"), true);
  assert.equal(CTKTKT_LINKED_DAILY_CODES.has("AF_ADJ"), true);
});

test("PPA actual data prefers CTKTKT links and keeps QLKT-only fields", () => {
  const dailyEntries = [
    { operatingDate: "2026-09-21", fieldCode: "C", value: "999" },
    { operatingDate: "2026-09-21", fieldCode: "I", value: "999" },
    { operatingDate: "2026-09-21", fieldCode: "F", value: "12.5" },
  ];
  const ctktktEntries = [
    { operatingDate: "2026-09-21", cell: "K157", value: "11200" },
    { operatingDate: "2026-09-21", cell: "K158", value: "11300" },
    { operatingDate: "2026-09-21", cell: "Q181", value: "10460.9417" },
  ];

  const merged = mergeDailyInputsWithCtktkt(dailyEntries, ctktktEntries, "2026-09");
  const values = Object.fromEntries(merged.map(entry => [entry.fieldCode, entry.value]));
  assert.equal(values.C, "11.2");
  assert.equal(values.I, "11.3");
  assert.equal(values.F, "12.5");
  assert.equal(values.Q181, "10460.9417");
});
