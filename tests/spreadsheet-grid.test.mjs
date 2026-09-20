import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSpreadsheetValue, parseSpreadsheetClipboard } from "../lib/spreadsheet-grid.ts";

test("chuẩn hóa số Việt Nam khi dán từ Excel nhưng giữ nguyên văn bản", () => {
  assert.equal(normalizeSpreadsheetValue("1.617.408,5"), "1617408.5");
  assert.equal(normalizeSpreadsheetValue("20.021,59"), "20021.59");
  assert.equal(normalizeSpreadsheetValue("1,617,408.5"), "1617408.5");
  assert.equal(normalizeSpreadsheetValue("0,10"), "0.10");
  assert.equal(normalizeSpreadsheetValue("Đạt"), "Đạt");
  assert.equal(normalizeSpreadsheetValue("—"), "");
});

test("đọc đúng ma trận nhiều hàng nhiều cột từ clipboard Excel", () => {
  assert.deepEqual(parseSpreadsheetClipboard("1\t2\t3\r\n4\t5\t6\r\n"), [
    ["1", "2", "3"],
    ["4", "5", "6"],
  ]);
});

test("tự bỏ cột nhãn khi người dùng copy cả tên chỉ tiêu", () => {
  assert.deepEqual(parseSpreadsheetClipboard("P TD 21\t0,1\t0,2\nQ TD 21\t0,3\t0,4"), [
    ["0.1", "0.2"],
    ["0.3", "0.4"],
  ]);
});
