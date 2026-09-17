import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGoogleSheetDayPayload,
  resolveGoogleSheetRow,
  validateGoogleAppsScriptUrl,
} from "../lib/google-sheet-sync.ts";

const entries = Object.entries({
  B: "10,70", C: "9,82", F: "24", H: "10,69", I: "9,83", L: "24",
  AE: "5.107,33", AF: "5.248,58", AJ: "20.142,99",
}).map(([fieldCode, value]) => ({ fieldCode, value }));

test("lập đúng dữ liệu Google Sheet cho S1, S2 và toàn nhà máy", () => {
  const payload = buildGoogleSheetDayPayload("2026-09-13", entries, {
    ppaPlant: 10_500,
    ppaS1: 10_450,
    ppaS2: 10_550,
    noteS1: "Theo công suất thực tế",
  });

  assert.equal(payload.date, "9/13/2026");
  assert.equal(payload.S1.sanLuong, 10.7);
  assert.equal(payload.S2.sanLuong, 10.69);
  assert.equal(payload.NMND.sanLuong, 21_390);
  assert.equal(payload.S1.csKhaDung, null);
  assert.ok(Math.abs(payload.S1.csBinhQuan - 445.833333) < 0.001);
  assert.ok(Math.abs(payload.S1.shnThucTe - 10_476.262) < 0.01);
  assert.match(payload.S1.danhGia, /Theo công suất thực tế/);
  assert.match(payload.S2.chenhLech, /kJ\/kWh/);
});

test("từ chối URL không phải bản triển khai Google Apps Script", () => {
  assert.equal(
    validateGoogleAppsScriptUrl("https://script.google.com/macros/s/example/exec?x=1#part"),
    "https://script.google.com/macros/s/example/exec",
  );
  assert.throws(() => validateGoogleAppsScriptUrl("https://evil.example/macros/s/example/exec"));
  assert.throws(() => validateGoogleAppsScriptUrl("http://script.google.com/macros/s/example/exec"));
});

test("xác định đúng hàng theo ngày ISO", () => {
  const rows = [{ row: 4, iso: "2026-09-12" }, { row: 5, iso: "2026-09-13" }];
  assert.equal(resolveGoogleSheetRow("2026-09-13", rows), 5);
  assert.equal(resolveGoogleSheetRow("2026-09-14", rows), null);
});

test("không tạo dữ liệu khi chưa có kết quả PPA", () => {
  assert.throws(() => buildGoogleSheetDayPayload("2026-09-13", entries, null), /chưa có kết quả PPA/i);
});
