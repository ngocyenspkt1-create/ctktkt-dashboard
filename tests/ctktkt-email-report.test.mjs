import assert from "node:assert/strict";
import { test } from "node:test";
import { CTKTKT_SAMPLE_2DAYS } from "../lib/ctktkt-sample-data.ts";
import { deriveCtktktCellsFromBcsx } from "../lib/ctktkt-bcsx-link.ts";
import {
  extractCtktktEmailMetrics,
  generateEmailReportText,
  generateEmailReportHtml,
} from "../lib/ctktkt-email-report.ts";

test("extractCtktktEmailMetrics accurately extracts all 22+ metrics from CTKTKT day 17 data", () => {
  const day16 = CTKTKT_SAMPLE_2DAYS["2026-09-16"];
  const day17 = CTKTKT_SAMPLE_2DAYS["2026-09-17"];

  const entries16 = Object.fromEntries(day16.manualEntries.map(e => [e.cell, e.value]));
  Object.assign(entries16, deriveCtktktCellsFromBcsx(day16.shiftReadings).entries);

  const entries17 = Object.fromEntries(day17.manualEntries.map(e => [e.cell, e.value]));
  Object.assign(entries17, deriveCtktktCellsFromBcsx(day17.shiftReadings).entries);

  const metrics = extractCtktktEmailMetrics(entries17, entries16);

  // S1 Power & Coal
  assert.equal(metrics.grossMwhS1, 11053.64);
  assert.ok(Math.abs(metrics.netMwhS1 - 10166.5842) < 0.01);
  assert.ok(Math.abs(metrics.auxMwhS1 - 887.0558) < 0.01);
  assert.ok(Math.abs(metrics.auxPercentS1 - 8.025) < 0.01);
  assert.ok(Math.abs(metrics.coalTonnesS1 - 5341.111) < 0.01);
  assert.ok(Math.abs(metrics.netCoalRateS1 - 525.359) < 0.01);
  assert.ok(Math.abs(metrics.hhvKjKgS1 - 20021.5934392878) < 0.001);
  assert.ok(Math.abs(metrics.netHeatRateS1 - 10518.5331267436) < 0.001);

  // S1 Steam & Water
  assert.equal(metrics.steamTonnesS1, 35582.55);
  assert.ok(Math.abs(metrics.steamRateGrossS1 - 3219.08) < 0.05);
  assert.ok(Math.abs(metrics.steamRateNetS1 - 3499.95) < 0.05);
  assert.ok(Math.abs(metrics.deminWaterS1 - 792.41) < 0.01);

  // S2 Power & Coal
  assert.equal(metrics.grossMwhS2, 11030.56);
  assert.ok(Math.abs(metrics.netMwhS2 - 10132.7348) < 0.01);
  assert.ok(Math.abs(metrics.auxMwhS2 - 897.8252) < 0.01);
  assert.ok(Math.abs(metrics.auxPercentS2 - 8.139) < 0.01);
  assert.ok(Math.abs(metrics.coalTonnesS2 - 5349.81764480845) < 0.001);
  assert.ok(Math.abs(metrics.netCoalRateS2 - 527.974) < 0.01);
  assert.ok(Math.abs(metrics.hhvKjKgS2 - 20021.5934392878) < 0.001);
  assert.ok(Math.abs(metrics.netHeatRateS2 - 10570.8750868209) < 0.001);

  // S2 Steam & Water
  assert.equal(metrics.steamTonnesS2, 34544.72);
  assert.ok(Math.abs(metrics.steamRateGrossS2 - 3131.73) < 0.05);
  assert.ok(Math.abs(metrics.steamRateNetS2 - 3409.22) < 0.05);
  assert.ok(Math.abs(metrics.deminWaterS2 - 926.5) < 0.01);

  // Common Plant Metrics
  assert.equal(metrics.coalIntake24h, 0);
  assert.ok(Math.abs(metrics.nh3UsedTonnes - 14.39) < 0.01);
  assert.ok(Math.abs(metrics.nh3RateGross - 0.65) < 0.01);
  assert.ok(Math.abs(metrics.nh3RateNet - 0.71) < 0.01);
  assert.equal(metrics.nh3Stock24h, 129.774);
  assert.equal(metrics.nh3IntakeDay, 0);
});

test("generateEmailReportText generates complete text report matching exact template structure", () => {
  const day16 = CTKTKT_SAMPLE_2DAYS["2026-09-16"];
  const day17 = CTKTKT_SAMPLE_2DAYS["2026-09-17"];
  const entries16 = Object.fromEntries(day16.manualEntries.map(e => [e.cell, e.value]));
  const entries17 = Object.fromEntries(day17.manualEntries.map(e => [e.cell, e.value]));
  const metrics = extractCtktktEmailMetrics(entries17, entries16);

  const text = generateEmailReportText(metrics, "Tổ C");

  // Check key lines from the required template
  assert.ok(text.includes("Tổ C- PXVH1 xin gửi các anh (chị) báo cáo gồm:"));
  assert.ok(text.includes("1. Chỉ tiêu kinh tế kỹ thuật:"));
  assert.ok(text.includes("- Tổ máy S1 vận hành:"));
  assert.ok(text.includes("+ Tổng sản lượng đầu cực máy phát S1: 11053.64 (MWh)"));
  assert.ok(text.includes("+ Tổng sản lượng tại điểm mua bán điện S1: 10166.58 (MWh)"));
  assert.ok(text.includes("+ Lượng điện tự dùng S1: 887.06 (MWh)"));
  assert.ok(text.includes("+ Phần trăm điện tự dùng S1: 8.03 % (đã bao gồm tổn thất MBA)"));
  assert.ok(text.includes("+ Tổng lượng than tiêu thụ S1: 5341.111 (tấn) - đã quy ẩm về 8.5%"));
  assert.ok(text.includes("+ Suất tiêu hao than tinh S1: 525.359 (g/kWh)"));
  assert.ok(text.includes("+ Nhiệt trị than quy ẩm: 20021.59 (kJ/kg)"));
  assert.ok(text.includes("+ Suất hao nhiệt tinh S1: 10518.533 (kJ/kWh)"));
  assert.ok(text.includes("+ Tổng lượng hơi tiêu thụ S1: 35582.55 (tấn)"));
  assert.ok(text.includes("+ Suất tiêu hao hơi theo sản lượng đầu cực S1: 3219.08 (g/kWh)"));
  assert.ok(text.includes("+ Suất tiêu hao hơi theo sản lượng phát lưới S1: 3499.95 (g/kWh)"));
  assert.ok(text.includes("+ Lượng nước demin sử dụng S1: 792.41 (tấn)"));

  assert.ok(text.includes("- Tổ máy S2 vận hành:"));
  assert.ok(text.includes("+ Tổng sản lượng đầu cực máy phát S2: 11030.56 (MWh)"));
  assert.ok(text.includes("+ Tổng sản lượng tại điểm mua bán điện S2: 10132.73 (MWh)"));
  assert.ok(text.includes("+ Lượng điện tự dùng S2: 897.83 (MWh)"));
  assert.ok(text.includes("+ Phần trăm điện tự dùng S2: 8.14 % (đã bao gồm tổn thất MBA)"));
  assert.ok(text.includes("+ Tổng lượng than tiêu thụ S2: 5349.818 (tấn) - đã quy ẩm về 8.5%"));
  assert.ok(text.includes("+ Suất tiêu hao than tinh S2: 527.974 (g/kWh)"));
  assert.ok(text.includes("+ Nhiệt trị than quy ẩm: 20021.59 (kJ/kg)"));
  assert.ok(text.includes("+ Suất hao nhiệt tinh S2: 10570.875 (kJ/kWh)"));
  assert.ok(text.includes("+ Tổng lượng hơi tiêu thụ S2: 34544.72 (tấn)"));
  assert.ok(text.includes("+ Suất tiêu hao hơi theo sản lượng đầu cực S2: 3131.73 (g/kWh)"));
  assert.ok(text.includes("+ Suất tiêu hao hơi theo sản lượng phát lưới S2: 3409.22 (g/kWh)"));
  assert.ok(text.includes("+ Lượng nước demin sử dụng S2: 926.50 (tấn)"));

  assert.ok(text.includes("- Tổng lượng than nhập kho 24h theo số liệu từ PX nhiêu liệu: 0 (tấn)"));
  assert.ok(text.includes("- Tổng lượng NH3 tiêu thụ trong ngày: 14.39 (tấn)"));
  assert.ok(text.includes("- Suất tiêu hao NH3 theo sản lượng đầu cực: 0.65 (g/kWh)"));
  assert.ok(text.includes("- Suất tiêu hao NH3 theo sản lượng phát lưới: 0.71 (g/kWh)"));
  assert.ok(text.includes("- Tổng lượng NH3 tồn kho: 129.774 (tấn)"));
  assert.ok(text.includes("- NH3 nhập trong ngày: 0 (tấn)"));

  assert.ok(text.includes("2. Báo cáo bao gồm các file:"));
  assert.ok(text.includes("- CTKTKT;"));
  assert.ok(text.includes("- BCSX NMĐ S1;"));
  assert.ok(text.includes("- BCSX NMĐ S2;"));
  assert.ok(text.includes("- BCSX NMĐ A0;"));
  assert.ok(text.includes("- Bảng theo dõi nước bổ sung trong ca;"));
  assert.ok(text.includes("Trân trọng!"));
});

test("generateEmailReportHtml applies Times New Roman font styling and HTML tags", () => {
  const day16 = CTKTKT_SAMPLE_2DAYS["2026-09-16"];
  const day17 = CTKTKT_SAMPLE_2DAYS["2026-09-17"];
  const entries16 = Object.fromEntries(day16.manualEntries.map(e => [e.cell, e.value]));
  const entries17 = Object.fromEntries(day17.manualEntries.map(e => [e.cell, e.value]));
  const metrics = extractCtktktEmailMetrics(entries17, entries16);

  const html = generateEmailReportHtml(metrics, "Tổ B");

  assert.ok(html.includes("font-family: 'Times New Roman'"));
  assert.ok(html.includes("Tổ B- PXVH1 xin gửi các anh (chị) báo cáo gồm:"));
  assert.ok(html.includes("<strong>- Tổ máy S1 vận hành:</strong>"));
  assert.ok(html.includes("<strong>- Tổ máy S2 vận hành:</strong>"));
  assert.ok(html.includes("<strong>2. Báo cáo bao gồm các file:</strong>"));
});

test("daily email always uses PMIS production instead of meter differences", () => {
  const previous = {
    AB8: "1000", AB9: "900", AB10: "100", AB11: "50",
    AL8: "2000", AL9: "1800", AL10: "200", AL11: "100",
  };
  const current = {
    AB8: "1100", AB9: "990", AB10: "106", AB11: "54",
    AL8: "2120", AL9: "1900", AL10: "206", AL11: "104",
    J157: "120", K157: "100", J158: "130", K158: "110",
  };

  const metrics = extractCtktktEmailMetrics(current, previous);
  assert.equal(metrics.grossMwhS1, 120);
  assert.equal(metrics.netMwhS1, 100);
  assert.equal(metrics.grossMwhS2, 130);
  assert.equal(metrics.netMwhS2, 110);
});

test("daily email adds received grid electricity without changing the normal auxiliary percentage", () => {
  const current = {
    J157: "0", K157: "0", J158: "100", K158: "90",
    GRID_RECEIVE_S1: "173.145", GRID_RECEIVE_S2: "5",
  };
  const metrics = extractCtktktEmailMetrics(current);

  assert.equal(metrics.auxMwhS1, 173.145);
  assert.equal(metrics.auxPercentS1, null);
  assert.equal(metrics.auxMwhS2, 15);
  assert.equal(metrics.auxPercentS2, 10);
});
