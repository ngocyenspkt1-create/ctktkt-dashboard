import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { deriveCtktktCellsFromBcsx } from "../lib/ctktkt-bcsx-link.ts";
import { CTKTKT_TEMPLATE_BASE64 } from "../lib/ctktkt-template.generated.ts";

async function loadTemplate() {
  const workbook = new ExcelJS.Workbook();
  const bytes = Uint8Array.from(atob(CTKTKT_TEMPLATE_BASE64), character => character.charCodeAt(0));
  await workbook.xlsx.load(bytes.buffer);
  return workbook;
}

function formulaMap(sheet) {
  const formulas = new Map();
  sheet.eachRow({ includeEmpty: true }, row => row.eachCell({ includeEmpty: true }, cell => {
    if (cell.value && typeof cell.value === "object" && "formula" in cell.value) formulas.set(cell.address, cell.value.formula);
  }));
  return formulas;
}

function styleMap(sheet) {
  const styles = new Map();
  sheet.eachRow({ includeEmpty: true }, row => row.eachCell({ includeEmpty: true }, cell => {
    if (cell.hasStyle) styles.set(cell.address, cell.styleId);
  }));
  return styles;
}

function sheetShape(sheet) {
  const pageSetup = {
    orientation: sheet.pageSetup.orientation,
    paperSize: sheet.pageSetup.paperSize,
    scale: sheet.pageSetup.scale,
    fitToWidth: sheet.pageSetup.fitToWidth,
    fitToHeight: sheet.pageSetup.fitToHeight,
    pageOrder: sheet.pageSetup.pageOrder,
    blackAndWhite: sheet.pageSetup.blackAndWhite,
    horizontalDpi: sheet.pageSetup.horizontalDpi,
    verticalDpi: sheet.pageSetup.verticalDpi,
  };
  return {
    rowCount: sheet.actualRowCount,
    columnCount: sheet.columnCount,
    merges: [...sheet.model.merges].sort(),
    pageSetup,
    pageMargins: sheet.pageSetup.margins,
    headerFooter: sheet.headerFooter,
    rowHeights: Array.from({ length: sheet.actualRowCount }, (_, index) => sheet.getRow(index + 1).height ?? null),
    columnWidths: Array.from({ length: sheet.columnCount }, (_, index) => sheet.getColumn(index + 1).width ?? null),
  };
}

test("CTKTKT export round-trip preserves all sheets, formulas, merges and print layout", async () => {
  const source = await loadTemplate();
  const sourceNames = source.worksheets.map(sheet => sheet.name);
  const shapes = new Map(source.worksheets.map(sheet => [sheet.name, sheetShape(sheet)]));
  const formulas = new Map(source.worksheets.map(sheet => [sheet.name, formulaMap(sheet)]));
  const styles = new Map(source.worksheets.map(sheet => [sheet.name, styleMap(sheet)]));

  source.getWorksheet("17").getCell("AB8").value = 123456.789;
  source.getWorksheet("17").getCell("J157").value = 11053.64;
  const linked = deriveCtktktCellsFromBcsx([
    { unit: "S1", timeSlot: "06:00", metric: "P", value: "438.25" },
    { unit: "S1", timeSlot: "06:00", metric: "D", value: "400.5" },
    { unit: "S1", timeSlot: "06:00", metric: "E", value: "233" },
    { unit: "S2", timeSlot: "06:00", metric: "E", value: "233" },
  ]);
  for (const [cell, value] of Object.entries(linked.entries)) source.getWorksheet("17").getCell(cell).value = Number(value);
  source.calcProperties.fullCalcOnLoad = true;
  const output = await source.xlsx.writeBuffer();
  const archive = await JSZip.loadAsync(output);
  const workbookXml = await archive.file("xl/workbook.xml").async("text");
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(output);

  assert.deepEqual(reopened.worksheets.map(sheet => sheet.name), sourceNames);
  for (const sheet of reopened.worksheets) {
    assert.deepEqual(sheetShape(sheet), shapes.get(sheet.name), `layout changed on ${sheet.name}`);
    assert.deepEqual(formulaMap(sheet), formulas.get(sheet.name), `formula changed on ${sheet.name}`);
    assert.deepEqual(styleMap(sheet), styles.get(sheet.name), `style changed on ${sheet.name}`);
  }
  assert.equal(reopened.getWorksheet("17").getCell("AB8").value, 123456.789);
  assert.equal(reopened.getWorksheet("17").getCell("J157").value, 11053.64);
  assert.equal(reopened.getWorksheet("17").getCell("M3").value, 438.25);
  assert.equal(reopened.getWorksheet("17").getCell("M7").value, 400.5);
  assert.equal(reopened.getWorksheet("17").getCell("M20").value, 233);
  assert.match(workbookXml, /fullCalcOnLoad="1"/);
});
