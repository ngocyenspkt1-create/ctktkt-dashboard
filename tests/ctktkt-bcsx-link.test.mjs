import assert from "node:assert/strict";
import { test } from "node:test";
import { CTKTKT_BCSX_LINKS, deriveCtktktCellsFromBcsx } from "../lib/ctktkt-bcsx-link.ts";

const times = ["06:00", "10:00", "14:00", "18:00", "22:00", "23:59"];

function completeReadings() {
  const readings = [];
  for (const [timeIndex, timeSlot] of times.entries()) {
    for (const [unitIndex, unit] of ["S1", "S2"].entries()) {
      readings.push({ unit, timeSlot, metric: "P", value: String(400 + unitIndex * 10 + timeIndex) });
      readings.push({ unit, timeSlot, metric: "Q", value: String(10 + unitIndex * 10 + timeIndex) });
      readings.push({ unit, timeSlot, metric: "D", value: String(360 + unitIndex * 10 + timeIndex) });
      readings.push({ unit, timeSlot, metric: "E", value: String(230 + timeIndex) });
    }
  }
  return readings;
}

test("BCSX section 1 maps 42 cells to the six CTKTKT sampling times", () => {
  const result = deriveCtktktCellsFromBcsx(completeReadings());
  assert.equal(CTKTKT_BCSX_LINKS.length, 42);
  assert.equal(Object.keys(result.entries).length, 42);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.entries.M3, "400");
  assert.equal(result.entries.R4, "15");
  assert.equal(result.entries.M7, "360");
  assert.equal(result.entries.R8, "375");
  assert.equal(result.entries.Q20, "234");
});

test("common 220 kV voltage is not chosen silently when S1 and S2 disagree", () => {
  const readings = completeReadings();
  readings.find(reading => reading.unit === "S2" && reading.timeSlot === "10:00" && reading.metric === "E").value = "233.5";
  const result = deriveCtktktCellsFromBcsx(readings);
  assert.equal(result.entries.N20, undefined);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0].message, /S1 \(231 kV\) khác S2 \(233.5 kV\)/);
});
