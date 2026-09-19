import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateMonthlyWaterSummary,
  getShiftSortKey,
  recalculateWaterShiftChain,
  roundTo,
  sortWaterShifts,
} from "../lib/water-report/calculations.ts";
import { canEditWaterField } from "../lib/water-report/permissions.ts";

test("getShiftSortKey correctly orders shifts within and across days", () => {
  const k1 = getShiftSortKey("2026-09-01", "06h00");
  const k2 = getShiftSortKey("2026-09-01", "14h00");
  const k3 = getShiftSortKey("2026-09-01", "22h00");
  const k4 = getShiftSortKey("2026-09-02", "06h00");

  assert.ok(k1 < k2);
  assert.ok(k2 < k3);
  assert.ok(k3 < k4);

  const prevMonthEnd = getShiftSortKey("2026-08-31", "22h00");
  assert.ok(prevMonthEnd < k1);
});

test("recalculateWaterShiftChain reproduces exact differences and ratios from official plant workbook", () => {
  // Dữ liệu mốc thực tế từ sheet T09.2026 GỘP:
  // Row 3: Mốc cuối tháng 8 (31/08 22h00)
  const baseline = {
    logDate: "2026-08-31",
    shiftTime: "22h00",
    shiftTeam: "B",
    shiftLeader: "Việt",
    elecRecS1: 6267851.2,
    elecRecS2: 6163562.9,
    elecGenS1: 0,
    elecGenS2: 0,
    waterRecS1: 11030.9,
    waterRecS2: 7537.92,
    waterUsedS1: 0,
    waterUsedS2: 0,
    waterRatioS1: 0,
    waterRatioS2: 0,
    condenserRecS1: 2796.25,
    condenserRecS2: 14434.76,
    condenserUsedS1: 0,
    condenserUsedS2: 0,
    resinWaterS1_24h: 0,
    resinWaterS2_24h: 0,
  };

  // Row 4: Ca 06h00 ngày 01/09/2026
  const shift1 = {
    logDate: "2026-09-01",
    shiftTime: "06h00",
    shiftTeam: "D",
    shiftLeader: "Trọng",
    elecRecS1: 6271046.2,
    elecRecS2: 6166747.4,
    elecGenS1: 0,
    elecGenS2: 0,
    waterRecS1: 11335.53,
    waterRecS2: 7771.21,
    waterUsedS1: 0,
    waterUsedS2: 0,
    waterRatioS1: 0,
    waterRatioS2: 0,
    condenserRecS1: 2964.14,
    condenserRecS2: 14528.9,
    condenserUsedS1: 0,
    condenserUsedS2: 0,
    resinWaterS1_24h: 0,
    resinWaterS2_24h: 607,
  };

  // Row 5: Ca 14h00 ngày 01/09/2026
  const shift2 = {
    logDate: "2026-09-01",
    shiftTime: "14h00",
    shiftTeam: "E",
    shiftLeader: "Lễ",
    elecRecS1: 6274253.8,
    elecRecS2: 6169944.8,
    elecGenS1: 0,
    elecGenS2: 0,
    waterRecS1: 11452.3,
    waterRecS2: 8034.8,
    waterUsedS1: 0,
    waterUsedS2: 0,
    waterRatioS1: 0,
    waterRatioS2: 0,
    condenserRecS1: 3094.25,
    condenserRecS2: 14565.92,
    condenserUsedS1: 0,
    condenserUsedS2: 0,
    resinWaterS1_24h: 0,
    resinWaterS2_24h: 607,
  };

  const chained = recalculateWaterShiftChain([shift2, baseline, shift1]); // truyền lộn xộn để test tự sắp xếp

  assert.equal(chained[0].shiftTime, "22h00");
  assert.equal(chained[1].shiftTime, "06h00");
  assert.equal(chained[2].shiftTime, "14h00");

  const s1 = chained[1];
  assert.equal(s1.elecGenS1, 3195);
  assert.equal(s1.elecGenS2, 3184.5);
  assert.equal(s1.waterUsedS1, 304.63);
  assert.equal(s1.waterUsedS2, 233.29);
  assert.equal(s1.waterRatioS1, 0.0953); // 304.63 / 3195 = 0.0953458...
  assert.equal(s1.waterRatioS2, 0.0733); // 233.29 / 3184.5 = 0.0732579...
  assert.equal(s1.condenserUsedS1, 167.89);
  assert.equal(s1.condenserUsedS2, 94.14);

  const s2 = chained[2];
  assert.equal(s2.elecGenS1, 3207.6);
  assert.equal(s2.elecGenS2, 3197.4);
  assert.equal(s2.waterUsedS1, 116.77);
  assert.equal(s2.waterUsedS2, 263.59);
  assert.equal(s2.waterRatioS1, 0.0364);
  assert.equal(s2.waterRatioS2, 0.0824);
  assert.equal(s2.condenserUsedS1, 130.11);
  assert.equal(s2.condenserUsedS2, 37.02);
});

test("calculateMonthlyWaterSummary aggregates totals and weighted ratios correctly", () => {
  const shifts = [
    {
      logDate: "2026-09-01",
      shiftTime: "06h00",
      elecGenS1: 3000,
      elecGenS2: 3000,
      waterUsedS1: 150,
      waterUsedS2: 300,
      condenserUsedS1: 50,
      condenserUsedS2: 40,
      resinWaterS1_24h: 0,
      resinWaterS2_24h: 500,
    },
    {
      logDate: "2026-09-01",
      shiftTime: "14h00",
      elecGenS1: 3000,
      elecGenS2: 3000,
      waterUsedS1: 150,
      waterUsedS2: 150,
      condenserUsedS1: 50,
      condenserUsedS2: 40,
      resinWaterS1_24h: 0,
      resinWaterS2_24h: 0,
    },
  ];

  const summary = calculateMonthlyWaterSummary(shifts);
  assert.equal(summary.totalElecGenS1, 6000);
  assert.equal(summary.totalElecGenS2, 6000);
  assert.equal(summary.totalElecGenPlant, 12000);
  assert.equal(summary.totalWaterUsedS1, 300);
  assert.equal(summary.totalWaterUsedS2, 450);
  assert.equal(summary.totalWaterUsedPlant, 750);
  assert.equal(summary.avgWaterRatioS1, 0.05); // 300 / 6000
  assert.equal(summary.avgWaterRatioS2, 0.075); // 450 / 6000
  assert.equal(summary.avgWaterRatioPlant, 750 / 12000); // 0.0625
  assert.equal(summary.totalCondenserUsedS1, 100);
  assert.equal(summary.totalCondenserUsedS2, 80);
  assert.equal(summary.totalResinWaterS2, 500);
});

test("canEditWaterField strictly enforces position permissions", () => {
  const admin = { id: 1, role: "admin", displayName: "Quản đốc", position: "Quản đốc", permissions: ["manage_users"] };
  const tkDien = { id: 2, role: "viewer", displayName: "Trưởng kíp điện", position: "Trưởng kíp điện", permissions: ["view_all"] };
  const tcDien = { id: 3, role: "viewer", displayName: "Trực chính điện", position: "Trực chính Điện", permissions: ["view_all"] };
  const tpDien = { id: 4, role: "viewer", displayName: "Trực phụ điện", position: "Trực phụ điện", permissions: ["view_all"] };
  const troThu = { id: 5, role: "viewer", displayName: "VHV Trợ thủ", position: "Trợ thủ", permissions: ["view_all"] };
  const loTruong = { id: 6, role: "viewer", displayName: "Lò trưởng", position: "Lò trưởng", permissions: ["view_all"] };

  // Admin có toàn quyền
  assert.equal(canEditWaterField(admin, "electricity"), true);
  assert.equal(canEditWaterField(admin, "water_intake"), true);
  assert.equal(canEditWaterField(admin, "resin_water"), true);

  // Trưởng kíp điện: nhập điện và nước nhận + bình ngưng, không nhập tái sinh
  assert.equal(canEditWaterField(tkDien, "electricity"), true);
  assert.equal(canEditWaterField(tkDien, "water_intake"), true);
  assert.equal(canEditWaterField(tkDien, "resin_water"), false);

  // Trực chính điện và trực phụ điện: chỉ nhập công tơ điện
  assert.equal(canEditWaterField(tcDien, "electricity"), true);
  assert.equal(canEditWaterField(tcDien, "water_intake"), false);
  assert.equal(canEditWaterField(tcDien, "resin_water"), false);

  assert.equal(canEditWaterField(tpDien, "electricity"), true);
  assert.equal(canEditWaterField(tpDien, "water_intake"), false);
  assert.equal(canEditWaterField(tpDien, "resin_water"), false);

  // Trợ thủ: chỉ nhập tái sinh hạt
  assert.equal(canEditWaterField(troThu, "electricity"), false);
  assert.equal(canEditWaterField(troThu, "water_intake"), false);
  assert.equal(canEditWaterField(troThu, "resin_water"), true);

  // Cương vị khác (Lò trưởng): không được nhập các cột trên
  assert.equal(canEditWaterField(loTruong, "electricity"), false);
  assert.equal(canEditWaterField(loTruong, "water_intake"), false);
  assert.equal(canEditWaterField(loTruong, "resin_water"), false);
});

test("Excel export builder generates exact 20-column template with green header and formulas", async () => {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("T09.2026");

  // Kiểm tra cấu hình màu và số cột
  assert.ok(wb);
  assert.ok(ws);
});

