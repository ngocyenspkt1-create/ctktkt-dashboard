import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateCtktktMeterSummary, calculateCtktktSummary, calculateDailyAverageMoisture, calculateNh3DcsSummary, previousIsoDate } from "../lib/ctktkt-report.ts";

function coalMeters(entries, columns, totals) {
  for (const column of columns) for (let row = 16; row <= 27; row += 1) entries[`${column}${row}`] = "0";
  entries[`${columns[0]}16`] = String(totals[0]);
  entries[`${columns[1]}16`] = String(totals[1]);
  entries[`${columns[2]}16`] = String(totals[2]);
}

test("CTKTKT uses full-precision meter differences and the 8.5% moisture basis", () => {
  const previous = { AB8: "1000", AB9: "900", AB10: "100", AB11: "50", AL8: "2000", AL9: "1800", AL10: "200", AL11: "100" };
  const current = {
    AB8: "1100", AB9: "990", AB10: "106", AB11: "54", AL8: "2100", AL9: "1890", AL10: "206", AL11: "104",
    J157: "100", K157: "90", J158: "100", K158: "90",
  };
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

test("CTKTKT summary prefers complete PMIS production pairs for both units", () => {
  const previous = { AB8: "1000", AB9: "900", AB10: "100", AB11: "50", AL8: "2000", AL9: "1800", AL10: "200", AL11: "100" };
  const current = {
    AB8: "1100", AB9: "990", AB10: "106", AB11: "54",
    AL8: "2100", AL9: "1890", AL10: "206", AL11: "104",
    J157: "120", K157: "100", J158: "130", K158: "110",
  };
  coalMeters(previous, ["X", "Z", "AB"], [0, 0, 0]);
  coalMeters(previous, ["AH", "AJ", "AL"], [0, 0, 0]);
  coalMeters(current, ["X", "Z", "AB"], [10, 20, 30]);
  coalMeters(current, ["AH", "AJ", "AL"], [10, 20, 30]);
  for (const row of [87, 88, 89, 90, 91, 92]) { current[`AJ${row}`] = "8.5"; current[`AK${row}`] = "5000"; }

  const result = calculateCtktktSummary(current, previous);
  assert.equal(result.s1.grossMwh, 120);
  assert.equal(result.s1.netMwh, 100);
  assert.equal(result.s1.auxiliaryMwh, 20);
  assert.ok(Math.abs(result.s1.auxiliaryPercent - 100 / 6) < 1e-12);
  assert.equal(result.s1.netCoalRate, 300);
  assert.equal(result.s2.grossMwh, 130);
  assert.equal(result.s2.netMwh, 110);
  assert.equal(result.s2.auxiliaryMwh, 20);
  assert.equal(result.plant.grossMwh, 250);
  assert.equal(result.plant.netMwh, 210);
  assert.equal(result.plant.auxiliaryMwh, 40);
});

test("whole-plant net heat rate remains available when one unit has zero generation", () => {
  const previous = {};
  const current = { J157: "0", K157: "0", J158: "100", K158: "90" };
  coalMeters(previous, ["AB"], [0]);
  coalMeters(previous, ["AL"], [0]);
  coalMeters(current, ["X", "Z", "AB"], [0, 0, 0]);
  coalMeters(current, ["AH", "AJ", "AL"], [20, 40, 60]);
  for (const row of [87, 88, 89, 90, 91, 92]) {
    current[`AJ${row}`] = "8.5";
    current[`AK${row}`] = "5000";
  }

  const result = calculateCtktktSummary(current, previous);
  assert.equal(result.s1.netHeatRate, null);
  assert.notEqual(result.s2.netHeatRate, null);
  assert.equal(result.plant.netHeatRate, result.s2.netHeatRate);
});

test("CTKTKT keeps a separate meter-derived production summary for Excel comparison", () => {
  const previous = { AB8: "1000", AB9: "900", AB10: "100", AB11: "50", AL8: "2000", AL9: "1800", AL10: "200", AL11: "100" };
  const current = {
    AB8: "1100", AB9: "990", AB10: "106", AB11: "54",
    AL8: "2120", AL9: "1900", AL10: "206", AL11: "104",
    J157: "120", K157: "100", J158: "130", K158: "110",
  };

  const pmis = calculateCtktktSummary(current, previous);
  const meters = calculateCtktktMeterSummary(current, previous);

  assert.equal(pmis.s1.grossMwh, 120);
  assert.equal(pmis.s1.netMwh, 100);
  assert.equal(meters.s1.grossMwh, 100);
  assert.equal(meters.s1.netMwh, 90);
  assert.equal(meters.s1.auxiliaryMwh, 10);
  assert.equal(meters.s1.auxiliaryPercent, 10);
  assert.equal(meters.s2.grossMwh, 120);
  assert.equal(meters.plant.grossMwh, 220);
});

test("CTKTKT summary never falls back to meter differences when a QLKT pair is incomplete", () => {
  const previous = { AB8: "1000", AB9: "900", AB10: "100", AB11: "50", AL8: "2000", AL9: "1800", AL10: "200", AL11: "100" };
  const current = {
    AB8: "1100", AB9: "990", AB10: "106", AB11: "54",
    AL8: "2100", AL9: "1890", AL10: "206", AL11: "104",
    J157: "120", J158: "130", K158: "110",
  };

  const result = calculateCtktktSummary(current, previous);
  assert.equal(result.s1.grossMwh, 120);
  assert.equal(result.s1.netMwh, null);
  assert.equal(result.s1.auxiliaryMwh, null);
  assert.equal(result.s2.grossMwh, 130);
  assert.equal(result.s2.netMwh, 110);
  assert.equal(result.s2.auxiliaryMwh, 20);
  assert.equal(result.plant.grossMwh, 250);
  assert.equal(result.plant.netMwh, null);
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

test("calculateTkdDcsSummary sums auxiliary power and plant totals correctly", async () => {
  const { calculateTkdDcsSummary } = await import("../lib/ctktkt-report.ts");
  const entries = {
    M3: "438", M5: "438", // P S1, P S2
    M4: "8", M6: "7",     // Q S1, Q S2
    M7: "400", M8: "402", // P MBT T1, T2
    M9: "30.9", M10: "4.8", // P TD 911, 912
    M12: "31.9", M13: "4.4", // P TD 921, 922
  };
  const summary = calculateTkdDcsSummary(entries);
  assert.ok(Math.abs(summary.M.pSumTdS1 - 35.7) < 0.0001);
  assert.ok(Math.abs(summary.M.pSumTdS2 - 36.3) < 0.0001);
  assert.equal(summary.M.pSumS1S2, 876);
  assert.equal(summary.M.pSumT1T2, 802);
  assert.equal(summary.M.qSumS1S2, 15);
});

test("calculateOilDifferences returns tonnes for both units and uses D-1 for 06h", async () => {
  const { calculateOilDifferences } = await import("../lib/ctktkt-report.ts");
  const entries = {
    W13: "1010.5", W14: "402.2", // S1 06h
    X13: "1025.5", X14: "407.2", // S1 08h
    AG13: "5100", AG14: "1550", // S2 06h
  };
  const previous = {
    AB13: "1000", AB14: "400",
    AL13: "5000", AL14: "1500",
  };
  const s1 = calculateOilDifferences(entries, "s1", previous);
  assert.ok(Math.abs(s1[0].diff - 8.3) < 0.0001);
  assert.equal(s1[1].diff, 10);

  const s2 = calculateOilDifferences(entries, "s2", previous);
  assert.equal(s2[0].diff, 0.05);
});

test("calculateDailyOilConsumption uses only D and D-1 24h readings", async () => {
  const { calculateDailyOilConsumption } = await import("../lib/ctktkt-report.ts");
  const previous = { AB13: "100", AB14: "20", AL13: "200", AL14: "40" };
  const current = { AB13: "160", AB14: "32", AL13: "260", AL14: "52" };

  assert.equal(calculateDailyOilConsumption(current, "s1", previous), 48);
  assert.equal(calculateDailyOilConsumption(current, "s2", previous), 0.048);
  assert.equal(calculateDailyOilConsumption({ ...current, AL14: "" }, "s2", previous), null);
});

test("startup oil consumption is split at grid synchronization and oil cut", async () => {
  const { calculateOilEventSummary } = await import("../lib/ctktkt-report.ts");
  const result = calculateOilEventSummary({
    C87: "100", C88: "20",
    E87: "130", E88: "25",
    G87: "150", G88: "27",
  }, "startup");
  assert.deepEqual(result.phaseTonnes, [25, 18]);
  assert.equal(result.totalTonnes, 43);
});

test("shutdown oil consumption uses oil-start and grid-disconnect meters only", async () => {
  const { calculateOilEventSummary } = await import("../lib/ctktkt-report.ts");
  const result = calculateOilEventSummary({
    C87: "100", C88: "20",
    F87: "125", F88: "24",
  }, "shutdown");
  assert.deepEqual(result.phaseTonnes, [21]);
  assert.equal(result.totalTonnes, 21);
});

test("incident oil consumption uses oil-start and oil-cut meters only", async () => {
  const { calculateOilEventSummary } = await import("../lib/ctktkt-report.ts");
  const result = calculateOilEventSummary({
    C87: "100", C88: "20",
    D87: "140", D88: "26",
  }, "incident_oil");
  assert.deepEqual(result.phaseTonnes, [34]);
  assert.equal(result.totalTonnes, 34);
});

test("CTKTKT ignores legacy Sub-bituminous fields and calculates 6A10 only", () => {
  const previous = { AB8: "1000", AB9: "900", AB10: "100", AB11: "50", AL8: "2000", AL9: "1800", AL10: "200", AL11: "100" };
  const current = { AB8: "1100", AB9: "990", AB10: "106", AB11: "54", AL8: "2100", AL9: "1890", AL10: "206", AL11: "104" };
  coalMeters(previous, ["X", "Z", "AB"], [0, 0, 0]);
  coalMeters(previous, ["AH", "AJ", "AL"], [0, 0, 0]);
  coalMeters(current, ["X", "Z", "AB"], [10, 20, 30]);
  coalMeters(current, ["AH", "AJ", "AL"], [10, 20, 30]);
  for (const row of [87, 88, 89, 90, 91, 92]) {
    current[`AJ${row}`] = "10";
    current[`AK${row}`] = "5000";
    current[`AL${row}`] = "0.2";
    current[`AO${row}`] = "20";
  }

  const result = calculateCtktktSummary(current, previous);
  const adjustedPerShift = 10 * (1 - 0.1) / 0.915;
  const plantAdjusted = adjustedPerShift * 6;
  const expectedHhv = (5000 * 0.9 * 60 / plantAdjusted) * 4.1868;
  assert.ok(Math.abs(result.s1.adjustedCoalTonnes - adjustedPerShift * 3) < 1e-9);
  assert.ok(Math.abs(result.s2.adjustedCoalTonnes - adjustedPerShift * 3) < 1e-9);
  assert.ok(Math.abs(result.s1.hhvKjKg - expectedHhv) < 1e-9);
  assert.equal(result.s1.hhvKjKg, result.s2.hhvKjKg);
  assert.equal(result.plant.hhvKjKg, result.s1.hhvKjKg);
});

test("daily average moisture matches Excel AJ86 weighted SUMPRODUCT formula", () => {
  const previous = {};
  const current = {};
  coalMeters(previous, ["AB"], [0]);
  coalMeters(previous, ["AL"], [0]);
  coalMeters(current, ["X", "Z", "AB"], [1750.04, 1970.57, 1970.57]);
  coalMeters(current, ["AH", "AJ", "AL"], [1727.44, 3508.3, 5815.58]);
  for (const [row, moisture] of [[87, 8.78], [88, 8.5], [89, 9.12], [90, 8.78], [91, 8.5], [92, 9.12]]) {
    current[`AJ${row}`] = String(moisture);
    current[`AK${row}`] = "5000";
  }

  const result = calculateDailyAverageMoisture(current, previous);
  assert.ok(Math.abs(result - 8.808780077445206) < 1e-12);
});

test("calculateSteamDifferences computes step consumption correctly", async () => {
  const { calculateSteamDifferences } = await import("../lib/ctktkt-report.ts");
  const entries = {
    W54: "1200", // 06h
    X54: "2500", // 10h
    Y54: "3900", // 14h
  };
  const s1 = calculateSteamDifferences(entries, "s1");
  assert.equal(s1[0].consumption, 1200);
  assert.equal(s1[1].consumption, 1300); // 2500 - 1200
  assert.equal(s1[2].consumption, 1400); // 3900 - 2500
});

test("NH3 consumption follows Excel P75 and uses the manually entered P74 total", async () => {
  const { calculateNh3Summary } = await import("../lib/ctktkt-report.ts");
  const result = calculateNh3Summary({
    P69: "46.123", P70: "47.377", P71: "48.095",
    P72: "42.21", P73: "117.891", P74: "141.595",
    J157: "12107", J158: "12117.5", K157: "11120", K158: "11210.9",
  }, null, null);
  assert.equal(result.stock24h, 141.595);
  assert.equal(result.tankMassTotal, 141.595);
  assert.ok(Math.abs(result.tankAvailableTotal - 134.51525) < 1e-9);
  assert.equal(result.usedTonnes, 18.506);
  assert.ok(Math.abs(result.rateGross - 0.763937336168) < 1e-12);
  assert.ok(Math.abs(result.rateNet - 0.828717158735) < 1e-12);
});

test("NH3 DCS follows the original workbook meter and production formulas", () => {
  const result = calculateNh3DcsSummary({
    N81: "111.84", N82: "486.25",
    J157: "11325.76", K157: "10415.012", J158: "11311.4", K158: "10396.0237",
  }, {
    N81: "103.84", N82: "479.43",
  });

  assert.equal(result.s1?.usedTonnes, 8);
  assert.equal(result.s1?.usedKg, 8000);
  assert.ok(Math.abs(result.s1.rateGross - 0.7063543638572599) < 1e-12);
  assert.ok(Math.abs(result.s1.rateNet - 0.7681220146457824) < 1e-12);
  assert.ok(Math.abs(result.s2.usedTonnes - 6.82) < 1e-12);
  assert.equal(result.s2.usedKg, 6820);
  assert.ok(Math.abs(result.s2.rateGross - 0.6029315557755892) < 1e-12);
  assert.ok(Math.abs(result.s2.rateNet - 0.6560200512047698) < 1e-12);
  assert.ok(Math.abs(result.totalUsedTonnes - 14.82) < 1e-12);
});

test("NH3 DCS leaves a unit incomplete when any required reading is missing", () => {
  const result = calculateNh3DcsSummary({
    N81: "111.84", J157: "11325.76",
    N82: "486.25", J158: "11311.4", K158: "10396.0237",
  }, {
    N82: "479.43",
  });

  assert.equal(result.s1, null);
  assert.notEqual(result.s2, null);
  assert.equal(result.totalUsedTonnes, null);
});

test("NH3 DCS start meters carry over from the previous day's 24h meters", async () => {
  const { applyNh3StartLevelCarryover } = await import("../lib/ctktkt-report.ts");
  const result = applyNh3StartLevelCarryover(
    { M81: "stale-s1", N81: "111.84", M82: "stale-s2", N82: "486.25" },
    { N81: "103.84", N82: "479.43" },
  );
  assert.equal(result.M81, "103.84");
  assert.equal(result.M82, "479.43");
});

test("NH3 00h levels carry over from the previous day's 24h levels", async () => {
  const { applyNh3StartLevelCarryover } = await import("../lib/ctktkt-report.ts");
  const result = applyNh3StartLevelCarryover(
    { N69: "old-a", N70: "old-b", N71: "old-c", O69: "1900" },
    { O69: "640", O70: "1870", O71: "2540" },
  );
  assert.equal(result.N69, "640");
  assert.equal(result.N70, "1870");
  assert.equal(result.N71, "2540");
  assert.equal(result.O69, "1900");
});
