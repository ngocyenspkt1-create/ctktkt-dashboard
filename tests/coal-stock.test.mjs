import assert from "node:assert/strict";
import { test } from "node:test";
import { CTKTKT_SAMPLE_2DAYS } from "../lib/ctktkt-sample-data.ts";
import { calculateCoalStock24h, coalConsumptionTonnes, COAL_STOCK_24H_START_CELL } from "../lib/coal-stock.ts";

const entriesOf = day => Object.fromEntries(CTKTKT_SAMPLE_2DAYS[day].manualEntries.map(e => [e.cell, e.value]));

function sampleMonth({ seed, intake }) {
  const day1 = { ...entriesOf("2026-09-16") };
  if (seed !== undefined) day1[COAL_STOCK_24H_START_CELL] = seed;
  const day2 = { ...entriesOf("2026-09-17") };
  if (intake === undefined) delete day2.I36;
  else day2.I36 = intake;
  return new Map([["2026-09-01", day1], ["2026-09-02", day2]]);
}

test("coal consumption uses moisture-adjusted S1 + S2 (W88 theo PMIS)", () => {
  const consumption = coalConsumptionTonnes(entriesOf("2026-09-17"), entriesOf("2026-09-16"));
  assert.ok(Math.abs(consumption - (5341.11098688518 + 5349.81764480845)) < 1e-6);
});

test("day 01 is the entered stock and later days chain D-1 + I36 - consumption", () => {
  const month = sampleMonth({ seed: "200000", intake: "7888.86" });
  assert.equal(calculateCoalStock24h(month, "2026-09-01").stock, 200000);

  const result = calculateCoalStock24h(month, "2026-09-02");
  assert.equal(result.missing, null);
  assert.ok(Math.abs(result.stock - (200000 + 7888.86 - 10690.92863169363)) < 1e-6);
  assert.equal(result.days.length, 2);
});

test("an intake of 0 is valid but a blank intake or missing seed stops the chain", () => {
  assert.ok(Math.abs(calculateCoalStock24h(sampleMonth({ seed: "200000", intake: "0" }), "2026-09-02").stock - (200000 - 10690.92863169363)) < 1e-6);

  const noIntake = calculateCoalStock24h(sampleMonth({ seed: "200000" }), "2026-09-02");
  assert.equal(noIntake.stock, null);
  assert.match(noIntake.missing, /I36\) ngày 02\/09\/2026/);

  const noSeed = calculateCoalStock24h(sampleMonth({ intake: "100" }), "2026-09-02");
  assert.equal(noSeed.stock, null);
  assert.match(noSeed.missing, /ngày 01\/09\/2026/);
});
