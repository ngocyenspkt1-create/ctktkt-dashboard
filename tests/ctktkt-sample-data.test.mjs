import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { CTKTKT_SAMPLE_2DAYS } from "../lib/ctktkt-sample-data.ts";
import { deriveCtktktCellsFromBcsx, CTKTKT_BCSX_LINKED_CELLS } from "../lib/ctktkt-bcsx-link.ts";
import { calculateCtktktSummary, calculateTkdDcsSummary, calculateOilDifferences, calculateSteamDifferences } from "../lib/ctktkt-report.ts";
import { CTKTKT_TEMPLATE_BASE64 } from "../lib/ctktkt-template.generated.ts";

test("CTKTKT sample data contains complete readings for 16/09/2026 and 17/09/2026", () => {
  const day16 = CTKTKT_SAMPLE_2DAYS["2026-09-16"];
  const day17 = CTKTKT_SAMPLE_2DAYS["2026-09-17"];

  assert.ok(day16, "Must have day 16 data");
  assert.ok(day17, "Must have day 17 data");

  // Check manual entries count
  assert.ok(day16.manualEntries.length > 300, `Day 16 has ${day16.manualEntries.length} entries`);
  assert.ok(day17.manualEntries.length > 300, `Day 17 has ${day17.manualEntries.length} entries`);

  // Check shift readings count (42 points)
  assert.equal(day16.shiftReadings.length, 42, "Day 16 BCSX readings must be 42");
  assert.equal(day17.shiftReadings.length, 42, "Day 17 BCSX readings must be 42");

  // Verify BCSX derivation (all 42 cells resolved)
  const derived16 = deriveCtktktCellsFromBcsx(day16.shiftReadings);
  const derived17 = deriveCtktktCellsFromBcsx(day17.shiftReadings);
  assert.equal(Object.keys(derived16.entries).length, 42);
  assert.equal(Object.keys(derived17.entries).length, 42);
  assert.equal(derived16.warnings.length, 0);
  assert.equal(derived17.warnings.length, 0);
});

test("Day 17 calculates full KPIs when Day 16 is present as previous day", () => {
  const day16 = CTKTKT_SAMPLE_2DAYS["2026-09-16"];
  const day17 = CTKTKT_SAMPLE_2DAYS["2026-09-17"];

  const entries16 = Object.fromEntries(day16.manualEntries.map(e => [e.cell, e.value]));
  const derived16 = deriveCtktktCellsFromBcsx(day16.shiftReadings);
  Object.assign(entries16, derived16.entries);

  const entries17 = Object.fromEntries(day17.manualEntries.map(e => [e.cell, e.value]));
  const derived17 = deriveCtktktCellsFromBcsx(day17.shiftReadings);
  Object.assign(entries17, derived17.entries);

  const summary = calculateCtktktSummary(entries17, entries16);

  // Power generation: S1: 11043 MWh, S2: 11020 MWh, Plant: 22063 MWh
  assert.equal(summary.s1.grossMwh, 11043);
  assert.equal(summary.s2.grossMwh, 11020);
  assert.equal(summary.plant.grossMwh, 22063);

  // Net generation
  assert.ok(Math.abs(summary.s1.netMwh - 10117.6) < 0.1);
  assert.ok(Math.abs(summary.s2.netMwh - 10094.2) < 0.1);
  assert.ok(Math.abs(summary.plant.netMwh - 20211.8) < 0.1);

  // Auxiliary power % (~8.39%)
  assert.ok(Math.abs(summary.plant.auxiliaryPercent - 8.39) < 0.05);

  // Coal consumption and heat rates
  assert.ok(summary.plant.rawCoalTonnes > 10000);
  assert.ok(summary.plant.adjustedCoalTonnes > 10000);
  assert.ok(summary.plant.netCoalRate > 500 && summary.plant.netCoalRate < 600);
  assert.ok(summary.plant.netHeatRate > 10000 && summary.plant.netHeatRate < 12000);

  // TKD DCS calculation
  const tkd = calculateTkdDcsSummary(entries17);
  assert.equal(tkd.M.pSumS1S2, 876); // P S1 (438) + P S2 (438) at 06h
  assert.ok(tkd.M.pSumTdS1 > 0);
  assert.ok(tkd.M.pSumTdS2 > 0);

  // Oil consumption calculation
  const oil1 = calculateOilDifferences(entries17, "s1");
  const oil2 = calculateOilDifferences(entries17, "s2");
  assert.equal(oil1.length, 6);
  assert.equal(oil2.length, 6);

  // Steam consumption calculation
  const steam1 = calculateSteamDifferences(entries17, "s1");
  const steam2 = calculateSteamDifferences(entries17, "s2");
  assert.equal(steam1.length, 6);
  assert.equal(steam2.length, 6);
});

test("Exporting month workbook with sample data populates sheets 16 and 17 correctly", async () => {
  const workbook = new ExcelJS.Workbook();
  const templateBytes = Uint8Array.from(atob(CTKTKT_TEMPLATE_BASE64), c => c.charCodeAt(0));
  await workbook.xlsx.load(templateBytes.buffer);

  const sheet16 = workbook.getWorksheet("16");
  const sheet17 = workbook.getWorksheet("17");
  assert.ok(sheet16, "Sheet 16 must exist");
  assert.ok(sheet17, "Sheet 17 must exist");

  const day16 = CTKTKT_SAMPLE_2DAYS["2026-09-16"];
  const day17 = CTKTKT_SAMPLE_2DAYS["2026-09-17"];

  // Populate sheet 16
  for (const entry of day16.manualEntries) {
    if (CTKTKT_BCSX_LINKED_CELLS.has(entry.cell)) continue;
    const num = Number(entry.value.replace(",", "."));
    sheet16.getCell(entry.cell).value = Number.isFinite(num) ? num : entry.value;
  }
  const derived16 = deriveCtktktCellsFromBcsx(day16.shiftReadings);
  for (const [cell, val] of Object.entries(derived16.entries)) {
    const num = Number(val.replace(",", "."));
    sheet16.getCell(cell).value = Number.isFinite(num) ? num : val;
  }

  // Populate sheet 17
  for (const entry of day17.manualEntries) {
    if (CTKTKT_BCSX_LINKED_CELLS.has(entry.cell)) continue;
    const num = Number(entry.value.replace(",", "."));
    sheet17.getCell(entry.cell).value = Number.isFinite(num) ? num : entry.value;
  }
  const derived17 = deriveCtktktCellsFromBcsx(day17.shiftReadings);
  for (const [cell, val] of Object.entries(derived17.entries)) {
    const num = Number(val.replace(",", "."));
    sheet17.getCell(cell).value = Number.isFinite(num) ? num : val;
  }

  // Check key cells in Sheet 17
  // Power meters:
  assert.equal(sheet17.getCell("AB8").value, 31724225);
  // Coal feeder D2 (Row 23):
  assert.equal(sheet17.getCell("AB23").value, 64733.87);
  // DCS TKD:
  assert.equal(sheet17.getCell("M3").value, 438);
  assert.equal(sheet17.getCell("M5").value, 438);
  // Voltage:
  assert.equal(sheet17.getCell("M20").value, 233);

  const buffer = await workbook.xlsx.writeBuffer();
  assert.ok(buffer.byteLength > 100000, "Exported buffer should be complete");
});
