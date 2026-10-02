import assert from "node:assert/strict";
import test from "node:test";
import { describeCtktktMissingField } from "../lib/data-completeness.ts";

test("CTKTKT warning describes the web row and column before the workbook cell", () => {
  const label = describeCtktktMissingField({
    cell: "N181", label: "7.6709 · 10", section: "pmis_02pd",
    sectionLabel: "Báo cáo PMIS 02-PĐ", row: 181,
  });
  assert.equal(label, "Hàng: Duyên Hải 1 · Cột: Suất hao nhiên liệu thô · Nội dung: Báo cáo PMIS 02-PĐ · Ô file chỉ tiêu: N181");
});

test("CTKTKT warning excludes workbook-only PMIS helper rows", () => {
  assert.equal(describeCtktktMissingField({
    cell: "N183", label: "10", section: "pmis_02pd",
    sectionLabel: "Báo cáo PMIS 02-PĐ", row: 183,
  }), null);
});

test("generic CTKTKT warning keeps a clear row, column, content and cell order", () => {
  const label = describeCtktktMissingField({
    cell: "N3", label: "P S1 (MW) · 10", section: "power_meter",
    sectionLabel: "Công suất và công tơ chính", row: 3,
  });
  assert.equal(label, "Hàng: P S1 (MW) · Cột: 10 · Nội dung: Công suất và công tơ chính · Ô file chỉ tiêu: N3");
});
