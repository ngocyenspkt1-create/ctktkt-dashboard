import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { buildCtktktHistoryImportPackage } from "../lib/ctktkt-history-import.ts";

function workbookBytes(sheets) {
  const workbook = XLSX.utils.book_new();
  for (const [name, values] of Object.entries(sheets)) {
    const worksheet = XLSX.utils.aoa_to_sheet([[""]]);
    for (const [cell, value] of Object.entries(values)) {
      worksheet[cell] = typeof value === "number" ? { t: "n", v: value } : { t: "s", v: value };
    }
    worksheet["!ref"] = "A1:W8";
    XLSX.utils.book_append_sheet(workbook, worksheet, name);
  }
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}

test("history import selects only the requested day and recognizes Vietnamese sheet names", async () => {
  const bytes = workbookBytes({
    "Ngày 16": {},
    "Ngày 17": { W8: 123.45 },
    "Ngày 18": { W8: 999 },
  });

  const result = await buildCtktktHistoryImportPackage("file-khong-can-ngay.xlsx", bytes, "2026-09-17");

  assert.equal(result.month, "2026-09");
  assert.equal(result.throughDay, 17);
  assert.equal(result.days.length, 1);
  assert.equal(result.days[0].date, "2026-09-17");
  assert.equal(result.days[0].sheetName, "Ngày 17");
  assert.equal(result.days[0].manualEntries.find(entry => entry.cell === "W8")?.value, "123.45");
  assert.equal(result.days.some(day => day.sheetName === "Ngày 18"), false);
});

test("history import recognizes a sheet named with the complete selected date", async () => {
  const bytes = workbookBytes({
    "20.09.2026": {},
    "21.09.2026": { W8: 321 },
  });

  const result = await buildCtktktHistoryImportPackage("bao-cao.xlsx", bytes, "2026-09-21");
  assert.equal(result.days[0].sheetName, "21.09.2026");
  assert.equal(result.days[0].manualEntries.find(entry => entry.cell === "W8")?.value, "321");
});

test("history import reports the exact previous sheet required for formula comparison", async () => {
  const bytes = workbookBytes({ "Ngày 17": { W8: 123 } });

  await assert.rejects(
    () => buildCtktktHistoryImportPackage("bao-cao.xlsx", bytes, "2026-09-17"),
    /Thiếu sheet 16 để tính và đối chiếu/,
  );
});

test("history import ignores draft cells that are not part of the day-03 reference", async () => {
  const bytes = workbookBytes({
    "Ngày 02": { W8: 100 },
    "Ngày 03": { W8: 120, G52: "1 thùng nháp" },
  });

  const result = await buildCtktktHistoryImportPackage("chi-tieu.xlsx", bytes, "2026-09-03");
  const importedCells = new Set(result.days[0].manualEntries.map(entry => entry.cell));

  assert.equal(importedCells.has("W8"), true);
  assert.equal(importedCells.has("G52"), false);
  assert.equal(result.days[0].manualEntries.find(entry => entry.cell === "C181")?.value, "1245");
});
