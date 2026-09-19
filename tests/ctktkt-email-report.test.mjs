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
  assert.equal(metrics.grossMwhS1, 11043);
  assert.ok(Math.abs(metrics.netMwhS1 - 10117.6) < 0.01);
  assert.ok(Math.abs(metrics.auxMwhS1 - 887.7) < 0.01);
  assert.ok(Math.abs(metrics.auxPercentS1 - 8.38) < 0.01);
  assert.ok(Math.abs(metrics.coalTonnesS1 - 5341.111) < 0.01);
  assert.ok(Math.abs(metrics.netCoalRateS1 - 527.903) < 0.01);
  assert.ok(Math.abs(metrics.hhvKjKgS1 - 19983.66) < 1.0);
  assert.ok(Math.abs(metrics.netHeatRateS1 - 10549.433) < 0.01);

  // S1 Steam & Water
  assert.equal(metrics.steamTonnesS1, 35582.55);
  assert.ok(Math.abs(metrics.steamRateGrossS1 - 3222.18) < 0.05);
  assert.ok(Math.abs(metrics.steamRateNetS1 - 3516.9) < 0.05);
  assert.ok(Math.abs(metrics.deminWaterS1 - 792.41) < 0.01);

  // S2 Power & Coal
  assert.equal(metrics.grossMwhS2, 11020);
  assert.ok(Math.abs(metrics.netMwhS2 - 10094.2) < 0.01);
  assert.ok(Math.abs(metrics.auxMwhS2 - 895.2) < 0.01);
  assert.ok(Math.abs(metrics.auxPercentS2 - 8.4) < 0.01);
  assert.ok(Math.abs(metrics.coalTonnesS2 - 5511.546) < 0.01);
  assert.ok(Math.abs(metrics.netCoalRateS2 - 546.011) < 0.01);
  assert.ok(Math.abs(metrics.hhvKjKgS2 - 19975.87) < 1.0);
  assert.ok(Math.abs(metrics.netHeatRateS2 - 10907.05) < 0.01);

  // S2 Steam & Water
  assert.equal(metrics.steamTonnesS2, 34544.72);
  assert.ok(Math.abs(metrics.steamRateGrossS2 - 3134.73) < 0.05);
  assert.ok(Math.abs(metrics.steamRateNetS2 - 3422.23) < 0.05);
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
  assert.ok(text.includes("+ Tổng sản lượng đầu cực máy phát S1: 11043.00 (MWh)"));
  assert.ok(text.includes("+ Tổng sản lượng tại điểm mua bán điện S1: 10117.60 (MWh)"));
  assert.ok(text.includes("+ Lượng điện tự dùng S1: 887.70 (MWh)"));
  assert.ok(text.includes("+ Phần trăm điện tự dùng S1: 8.38 % (đã bao gồm tổn thất MBA)"));
  assert.ok(text.includes("+ Tổng lượng than tiêu thụ S1: 5341.111 (tấn) - đã quy ẩm về 8.5%"));
  assert.ok(text.includes("+ Suất tiêu hao than tinh S1: 527.903 (g/kWh)"));
  assert.ok(text.includes("+ Nhiệt trị than quy ẩm: 19983.66 (kJ/kg)"));
  assert.ok(text.includes("+ Suất hao nhiệt tinh S1: 10549.433 (kJ/kWh)"));
  assert.ok(text.includes("+ Tổng lượng hơi tiêu thụ S1: 35582.55 (tấn)"));
  assert.ok(text.includes("+ Suất tiêu hao hơi theo sản lượng đầu cực S1: 3222.18 (g/kWh)"));
  assert.ok(text.includes("+ Suất tiêu hao hơi theo sản lượng phát lưới S1: 3516.90 (g/kWh)"));
  assert.ok(text.includes("+ Lượng nước demin sử dụng S1: 792.41 (tấn)"));

  assert.ok(text.includes("- Tổ máy S2 vận hành:"));
  assert.ok(text.includes("+ Tổng sản lượng đầu cực máy phát S2: 11020.00 (MWh)"));
  assert.ok(text.includes("+ Tổng sản lượng tại điểm mua bán điện S2: 10094.20 (MWh)"));
  assert.ok(text.includes("+ Lượng điện tự dùng S2: 895.20 (MWh)"));
  assert.ok(text.includes("+ Phần trăm điện tự dùng S2: 8.40 % (đã bao gồm tổn thất MBA)"));
  assert.ok(text.includes("+ Tổng lượng than tiêu thụ S2: 5511.546 (tấn) - đã quy ẩm về 8.5%"));
  assert.ok(text.includes("+ Suất tiêu hao than tinh S2: 546.011 (g/kWh)"));
  assert.ok(text.includes("+ Nhiệt trị than quy ẩm: 19975.87 (kJ/kg)"));
  assert.ok(text.includes("+ Suất hao nhiệt tinh S2: 10907.050 (kJ/kWh)"));
  assert.ok(text.includes("+ Tổng lượng hơi tiêu thụ S2: 34544.72 (tấn)"));
  assert.ok(text.includes("+ Suất tiêu hao hơi theo sản lượng đầu cực S2: 3134.73 (g/kWh)"));
  assert.ok(text.includes("+ Suất tiêu hao hơi theo sản lượng phát lưới S2: 3422.23 (g/kWh)"));
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

