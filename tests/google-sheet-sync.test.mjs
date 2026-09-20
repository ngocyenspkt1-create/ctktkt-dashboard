import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGoogleSheetDayPayload,
  parseGoogleSheetAssessmentRows,
  parseAvailableCapacity,
  PPA_AVAILABLE_CAPACITY_S1_CODE,
  PPA_AVAILABLE_CAPACITY_S2_CODE,
  resolveGoogleSheetRow,
  validateGoogleAppsScriptUrl,
} from "../lib/google-sheet-sync.ts";

const entries = Object.entries({
  B: "10,70", C: "9,82", F: "24", H: "10,69", I: "9,83", L: "24",
  AE: "5.107,33", AF: "5.248,58", AJ: "20.142,99",
  [PPA_AVAILABLE_CAPACITY_S1_CODE]: "622,5", [PPA_AVAILABLE_CAPACITY_S2_CODE]: "615,2",
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
  assert.equal(payload.S1.csKhaDung, 622.5);
  assert.equal(payload.S2.csKhaDung, 615.2);
  assert.equal(payload.NMND.csKhaDung, null);
  assert.ok(Math.abs(payload.S1.csBinhQuan - 445.833333) < 0.001);
  assert.ok(Math.abs(payload.S1.shnThucTe - 10_476.262) < 0.01);
  assert.match(payload.S1.danhGia, /Theo công suất thực tế/);
  assert.match(payload.S2.chenhLech, /kJ\/kWh/);
});

test("xuất Google Sheet giữ đủ độ chính xác QLKT ngày 17/09", () => {
  const preciseEntries = Object.entries({
    B: "11.05364", C: "10.1665842", F: "24",
    H: "11.03056", I: "10.1327348", L: "24",
    AE: "5341.111", AF: "5349.818", AJ: "20021.593",
    [PPA_AVAILABLE_CAPACITY_S1_CODE]: "622.5", [PPA_AVAILABLE_CAPACITY_S2_CODE]: "622.5",
  }).map(([fieldCode, value]) => ({ fieldCode, value }));
  const payload = buildGoogleSheetDayPayload("2026-09-17", preciseEntries, {
    ppaPlant: 10_500, ppaS1: 10_500, ppaS2: 10_500,
  });
  assert.ok(Math.abs(payload.S1.shnThucTe - 10518.53292178734) < 1e-9);
  assert.ok(Math.abs(payload.S2.shnThucTe - 10570.875556722753) < 1e-9);
  assert.ok(Math.abs(payload.NMND.shnThucTe - 10544.660598214996) < 1e-9);
  assert.match(payload.NMND.chenhLech, /\+44,66 kJ\/kWh/);
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

test("không đẩy Google Sheet khi thiếu công suất khả dụng S1 hoặc S2", () => {
  const incomplete = entries.filter(entry => entry.fieldCode !== PPA_AVAILABLE_CAPACITY_S2_CODE);
  assert.throws(() => buildGoogleSheetDayPayload("2026-09-13", incomplete, {
    ppaPlant: 10_500, ppaS1: 10_450, ppaS2: 10_550,
  }), /Công suất khả dụng S2/);
});

test("công suất khả dụng nhận dấu phẩy thập phân và chặn giá trị ngoài giới hạn", () => {
  assert.equal(parseAvailableCapacity("622,5", "CSKD S1"), 622.5);
  assert.equal(parseAvailableCapacity("", "CSKD S1"), null);
  assert.throws(() => parseAvailableCapacity("1001", "CSKD S1"), /0 đến 1.000 MW/);
  assert.throws(() => parseAvailableCapacity("abc", "CSKD S1"), /0 đến 1.000 MW/);
});

test("đọc danh sách đánh giá lịch sử và bỏ dòng trống", () => {
  const rows = parseGoogleSheetAssessmentRows([
    { row: 4, iso: "2026-09-12", noteS1: "Vượt PPA - UC tro xỉ cao", noteS2: "Đạt PPA" },
    { row: 5, iso: "2026-09-13", noteS1: "", noteS2: "" },
  ]);
  assert.deepEqual(rows, [{ row: 4, iso: "2026-09-12", noteS1: "Vượt PPA - UC tro xỉ cao", noteS2: "Đạt PPA" }]);
});

test("giữ nguyên đánh giá đầy đủ đã nhập từ Google Sheet khi đẩy trở lại", () => {
  const payload = buildGoogleSheetDayPayload("2026-09-13", entries, {
    ppaPlant: 10_500,
    ppaS1: 10_450,
    ppaS2: 10_550,
    noteS1: "Vượt PPA - Nhiệt trị than thấp",
  });
  assert.equal(payload.S1.danhGia, "Vượt PPA - Nhiệt trị than thấp");
  const achieved = buildGoogleSheetDayPayload("2026-09-13", entries, {
    ppaPlant: 10_500,
    ppaS1: 10_450,
    ppaS2: 10_550,
    noteS2: "Đạt - UC trong tro xỉ thấp hơn tiêu chuẩn",
  });
  assert.equal(achieved.S2.danhGia, "Đạt - UC trong tro xỉ thấp hơn tiêu chuẩn");
});
