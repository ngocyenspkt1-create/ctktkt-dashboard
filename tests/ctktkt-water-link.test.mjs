import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

test("CTKTKT water link targets source cells and preserves Excel formula cells", () => {
  const linkSource = fs.readFileSync(new URL("../lib/ctktkt-water-link.ts", import.meta.url), "utf8");
  for (const cell of ["W72", "X72", "Z72", "W73", "X73", "Z73"]) {
    assert.match(linkSource, new RegExp(`cell: \\"${cell}\\"`));
  }
  for (const formulaCell of ["Y72", "Y73", "Y74", "Z74"]) {
    assert.doesNotMatch(linkSource, new RegExp(`cell: \\"${formulaCell}\\"`));
  }

  const exportSource = fs.readFileSync(new URL("../app/api/ctktkt-report/export/route.ts", import.meta.url), "utf8");
  assert.match(exportSource, /applyWaterLinks\(sheet, date\)/);
});

test("original CTKTKT workbook keeps the daily water formulas", async () => {
  const ExcelJS = (await import("exceljs")).default;
  const { CTKTKT_TEMPLATE_BASE64 } = await import("../lib/ctktkt-template.generated.ts");
  const workbook = new ExcelJS.Workbook();
  const bytes = Uint8Array.from(Buffer.from(CTKTKT_TEMPLATE_BASE64, "base64"));
  await workbook.xlsx.load(bytes.buffer);
  const sheet = workbook.getWorksheet("01");
  assert.ok(sheet);
  assert.equal(sheet.getCell("Y72").formula, "X72-W72");
  assert.equal(sheet.getCell("Y73").formula, "(X73-W73)");
  assert.equal(sheet.getCell("Y74").formula, "Y72+Y73");
  assert.equal(sheet.getCell("Z74").formula, "Z72+Z73");
});
