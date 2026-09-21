import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { CTKTKT_DAY03_INPUT_CELLS, CTKTKT_INPUT_FIELDS } from "../lib/ctktkt-fields.generated.ts";
import { CTKTKT_TEMPLATE_BASE64 } from "../lib/ctktkt-template.generated.ts";

function formulaAt(sheet, cell) {
  const value = sheet.getCell(cell).value;
  return value && typeof value === "object" && "formula" in value ? value.formula : null;
}

test("day 03 is the canonical CTKTKT input and export template", async () => {
  assert.equal(CTKTKT_INPUT_FIELDS.some(field => field.cell === "G52"), true);
  assert.equal(CTKTKT_DAY03_INPUT_CELLS.includes("G52"), false);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(CTKTKT_TEMPLATE_BASE64, "base64"));
  const day03 = workbook.getWorksheet("03");
  assert.ok(day03);

  assert.equal(day03.getCell("G52").value, null);
  for (let day = 1; day <= 31; day += 1) {
    const sheetName = String(day).padStart(2, "0");
    const sheet = workbook.getWorksheet(sheetName);
    assert.ok(sheet, `missing daily sheet ${sheetName}`);
    assert.equal(sheet.getCell("G52").value, null);
    assert.deepEqual([...sheet.model.merges].sort(), [...day03.model.merges].sort());
    assert.deepEqual(sheet.getCell("M3").style, day03.getCell("M3").style);
    assert.deepEqual(sheet.pageSetup, day03.pageSetup);
    const previousSheet = day === 1 ? "d-1" : String(day - 1).padStart(2, "0");
    assert.equal(formulaAt(sheet, "C4"), `'${previousSheet}'!D4`);
  }
});
