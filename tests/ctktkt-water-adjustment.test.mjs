import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import {
  CTKTKT_WATER_ADJUSTMENT_FIELDS,
  CTKTKT_WATER_ADJUSTMENT_NOTE_FIELDS,
  CTKTKT_TEXT_INPUT_CELLS,
  CTKTKT_NON_WORKBOOK_INPUT_CELLS,
  getCtktktWaterAdjustments,
  normalizeCtktktInputValue,
} from "../lib/ctktkt-extra-fields.ts";
import { getCtktktFieldGroup, canEditCtktktField } from "../lib/ctktkt-permissions.ts";
import { extractCtktktEmailMetrics } from "../lib/ctktkt-email-report.ts";
import { CTKTKT_TEMPLATE_BASE64 } from "../lib/ctktkt-template.generated.ts";

test("Water adjustment fields are properly configured in extra fields and permissions", () => {
  assert.equal(CTKTKT_WATER_ADJUSTMENT_FIELDS.length, 2);
  assert.equal(CTKTKT_WATER_ADJUSTMENT_NOTE_FIELDS.length, 2);

  assert.ok(CTKTKT_TEXT_INPUT_CELLS.has("WATER_ADJ_NOTE_S1"));
  assert.ok(CTKTKT_TEXT_INPUT_CELLS.has("WATER_ADJ_NOTE_S2"));
  assert.ok(!CTKTKT_TEXT_INPUT_CELLS.has("WATER_ADJ_S1"));
  assert.ok(!CTKTKT_TEXT_INPUT_CELLS.has("WATER_ADJ_S2"));

  assert.ok(CTKTKT_NON_WORKBOOK_INPUT_CELLS.has("WATER_ADJ_S1"));
  assert.ok(CTKTKT_NON_WORKBOOK_INPUT_CELLS.has("WATER_ADJ_S2"));
  assert.ok(CTKTKT_NON_WORKBOOK_INPUT_CELLS.has("WATER_ADJ_NOTE_S1"));
  assert.ok(CTKTKT_NON_WORKBOOK_INPUT_CELLS.has("WATER_ADJ_NOTE_S2"));

  // Permissions: thuộc nhóm tkd_trend
  assert.equal(getCtktktFieldGroup("WATER_ADJ_S1"), "tkd_trend");
  assert.equal(getCtktktFieldGroup("WATER_ADJ_S2"), "tkd_trend");
  assert.equal(getCtktktFieldGroup("WATER_ADJ_NOTE_S1"), "tkd_trend");
  assert.equal(getCtktktFieldGroup("WATER_ADJ_NOTE_S2"), "tkd_trend");

  // Trưởng kíp điện có quyền chỉnh sửa
  const tkdUser = {
    username: "tkd_user",
    role: "user",
    position: "Trưởng kíp điện",
    permissions: [],
  };
  assert.equal(canEditCtktktField(tkdUser, "WATER_ADJ_S1"), true);
  assert.equal(canEditCtktktField(tkdUser, "WATER_ADJ_S2"), true);
  assert.equal(canEditCtktktField(tkdUser, "WATER_ADJ_NOTE_S1"), true);
  assert.equal(canEditCtktktField(tkdUser, "WATER_ADJ_NOTE_S2"), true);
});

test("normalizeCtktktInputValue formats water adjustment and preserves reason text", () => {
  assert.equal(normalizeCtktktInputValue("WATER_ADJ_S1", " 25000,5 "), "25000.5");
  assert.equal(normalizeCtktktInputValue("WATER_ADJ_NOTE_S1", " Reset qua mốc 25.000 m³ "), "Reset qua mốc 25.000 m³");
});

test("getCtktktWaterAdjustments extracts numeric adjustments and note strings", () => {
  const row = {
    "KTKT:WATER_ADJ_S1": "25000",
    "KTKT:WATER_ADJ_NOTE_S1": "Đảo công tơ 25000 về 0",
    "KTKT:WATER_ADJ_S2": "12.5",
    "KTKT:WATER_ADJ_NOTE_S2": "Cân chỉnh đồng hồ đo",
  };
  const parsed = getCtktktWaterAdjustments(row);
  assert.equal(parsed.adjS1, 25000);
  assert.equal(parsed.adjS2, 12.5);
  assert.equal(parsed.noteS1, "Đảo công tơ 25000 về 0");
  assert.equal(parsed.noteS2, "Cân chỉnh đồng hồ đo");
});

test("Rollover calculation: net water usage with max 25.000 m³ reset", () => {
  // Giả định ngày D-1 W72 = 24800, ngày D X72 = 300 (công tơ reset về 0)
  const w = 24800;
  const x = 300;
  const rawDiff = x - w; // -24500
  assert.equal(rawDiff < 0, true);

  const adj = 25000;
  const netUsage = rawDiff + adj; // 500 m³
  assert.equal(netUsage, 500);
});

test("Email report correctly reflects water meter adjustments", () => {
  const mockEntries = {
    X72: "300",
    W72: "24800",
    WATER_ADJ_S1: "25000",
    X73: "500",
    W73: "200",
    WATER_ADJ_S2: "0",
  };
  const mockSummary = {
    s1: { grossMwh: 1000, netMwh: 900, auxiliaryMwh: 100, auxiliaryPercent: 10, rawCoalTonnes: 500, adjustedCoalTonnes: 500, netCoalRate: 500, netHeatRate: 8000, hhvKjKg: 20000 },
    s2: { grossMwh: 1000, netMwh: 900, auxiliaryMwh: 100, auxiliaryPercent: 10, rawCoalTonnes: 500, adjustedCoalTonnes: 500, netCoalRate: 500, netHeatRate: 8000, hhvKjKg: 20000 },
    plant: { grossMwh: 2000, netMwh: 1800, auxiliaryMwh: 200, auxiliaryPercent: 10, rawCoalTonnes: 1000, adjustedCoalTonnes: 1000, netCoalRate: 500, netHeatRate: 8000, hhvKjKg: 20000 },
  };

  const metrics = extractCtktktEmailMetrics(mockEntries, mockSummary, "2026-09-17");
  // deminWaterS1 = (300 - 24800) + 25000 = 500
  assert.equal(metrics.deminWaterS1, 500);
  // deminWaterS2 = 500 - 200 + 0 = 300
  assert.equal(metrics.deminWaterS2, 300);
});
