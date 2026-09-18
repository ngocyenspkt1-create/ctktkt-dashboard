import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { buildBcsxWorkbookFromTemplate, SHIFT_METRICS, SHIFT_TIME_SLOTS } from "../lib/bcsx.ts";
import { BCSX_TEMPLATE_A0_BASE64, BCSX_TEMPLATE_S1_BASE64, BCSX_TEMPLATE_S2_BASE64 } from "../lib/bcsx-templates.generated.ts";

const templates = {
  S1: { url: new URL("../assets/bcsx-templates/bcsx-s1-template.xlsx", import.meta.url), base64: BCSX_TEMPLATE_S1_BASE64 },
  S2: { url: new URL("../assets/bcsx-templates/bcsx-s2-template.xlsx", import.meta.url), base64: BCSX_TEMPLATE_S2_BASE64 },
  A0: { url: new URL("../assets/bcsx-templates/bcsx-a0-template.xlsx", import.meta.url), base64: BCSX_TEMPLATE_A0_BASE64 },
};

async function loadWorkbook(input) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(input);
  return workbook;
}

function comparableColumns(worksheet) {
  return worksheet.columns.map(column => ({
    width: column.width,
    hidden: column.hidden,
    outlineLevel: column.outlineLevel,
    style: column.style,
  }));
}

function comparableRows(worksheet) {
  return Array.from({ length: worksheet.rowCount }, (_, index) => {
    const row = worksheet.getRow(index + 1);
    return { height: row.height, hidden: row.hidden, outlineLevel: row.outlineLevel, style: row.style };
  });
}

function comparablePageSetup(worksheet) {
  const pageSetup = { ...worksheet.pageSetup };
  delete pageSetup.firstPageNumber;
  delete pageSetup.useFirstPageNumber;
  return pageSetup;
}

test("BCSX has all 48 source-template time points including 23:30 and 23:59", () => {
  assert.equal(SHIFT_TIME_SLOTS.length, 48);
  assert.equal(SHIFT_TIME_SLOTS[0], "00:30");
  assert.equal(SHIFT_TIME_SLOTS[46], "23:30");
  assert.equal(SHIFT_TIME_SLOTS[47], "23:59");
});

for (const unit of ["S1", "S2", "A0"]) {
  test(`exported BCSX ${unit} preserves the template and writes every intended cell`, async () => {
    const unitOffset = unit === "S1" ? 0 : unit === "S2" ? 1000 : 2000;
    const readings = Object.fromEntries(SHIFT_METRICS.map((metric, metricIndex) => [
      metric.key,
      SHIFT_TIME_SLOTS.map((_, index) => unitOffset + metricIndex * 100 + index + 0.25),
    ]));
    const events = [
      { startAt: "2026-09-18 01:02", endAt: "2026-09-18 03:04", eventType: 2, description: `${unit} sự kiện 1` },
      { startAt: "2026-09-18 05:06", endAt: "", eventType: 4, description: `${unit} sự kiện 2` },
    ];
    const totals = { dauCuc: 10001.5 + unitOffset, thuongPham: 9500.25 + unitOffset, thanTieuThu: 4321.75 + unitOffset, thanTonKho: 88888.5 };

    const templateBytes = readFileSync(templates[unit].url);
    assert.deepEqual(Buffer.from(templates[unit].base64, "base64"), templateBytes, "embedded template is not byte-identical to the source template");
    const generatedBuffer = Buffer.from(await buildBcsxWorkbookFromTemplate({ operatingDate: "2026-09-18", unit, readings, totals, events }, templates[unit].base64));
    const [templateWorkbook, generatedWorkbook] = await Promise.all([
      loadWorkbook(templateBytes),
      loadWorkbook(generatedBuffer),
    ]);
    assert.deepEqual(generatedWorkbook.worksheets.map(sheet => sheet.name), templateWorkbook.worksheets.map(sheet => sheet.name));
    const original = templateWorkbook.getWorksheet("BCSX");
    const output = generatedWorkbook.getWorksheet("BCSX");
    assert.ok(original && output);

    assert.deepEqual([...output.model.merges].sort(), [...original.model.merges].sort(), "merged cells changed");
    // ExcelJS normalizes the equivalent default first-page-number flags while
    // reserializing; compare every layout setting that affects the printed file.
    assert.deepEqual(comparablePageSetup(output), comparablePageSetup(original), "page setup changed");
    assert.deepEqual(output.pageMargins, original.pageMargins, "page margins changed");
    assert.deepEqual(output.headerFooter, original.headerFooter, "header/footer changed");
    assert.deepEqual(output.views, original.views, "worksheet views changed");
    assert.deepEqual(output.properties, original.properties, "worksheet properties changed");
    assert.deepEqual(comparableColumns(output), comparableColumns(original), "column layout/style changed");
    assert.deepEqual(comparableRows(output), comparableRows(original), "row layout/style changed");

    const writable = new Set();
    for (let row = 11; row <= 58; row++) for (const column of ["B", "C", "D", "E"]) writable.add(`${column}${row}`);
    for (let row = 60; row <= 64; row++) writable.add(`C${row}`);
    for (let row = 72; row <= 73; row++) for (const column of ["A", "B", "C", "D", "E", "F", "G", "H"]) writable.add(`${column}${row}`);

    for (let row = 1; row <= original.rowCount; row++) {
      for (let column = 1; column <= original.columnCount; column++) {
        const originalCell = original.getCell(row, column);
        const outputCell = output.getCell(row, column);
        assert.deepEqual(outputCell.style, originalCell.style, `${outputCell.address} style changed`);
        if (!writable.has(outputCell.address)) assert.deepEqual(outputCell.value, originalCell.value, `${outputCell.address} changed outside export fields`);
      }
    }

    for (const [metricIndex, metric] of SHIFT_METRICS.entries()) {
      for (let index = 0; index < SHIFT_TIME_SLOTS.length; index++) {
        assert.equal(output.getCell(`${metric.col}${11 + index}`).value, unitOffset + metricIndex * 100 + index + 0.25);
      }
    }
    assert.equal(output.getCell("C60").value, totals.dauCuc);
    assert.equal(output.getCell("C61").value, totals.thuongPham);
    assert.equal(output.getCell("C62").value, totals.dauCuc - totals.thuongPham);
    assert.equal(output.getCell("C63").value, totals.thanTieuThu);
    assert.equal(output.getCell("C64").value, totals.thanTonKho);
    assert.equal(output.getCell("A72").value, "09/18/2026 01:02");
    assert.equal(output.getCell("B72").value, "09/18/2026 03:04");
    assert.equal(output.getCell("C72").value, 2);
    assert.equal(output.getCell("D72").value, `${unit} sự kiện 1`);
    assert.equal(output.getCell("A73").value, "09/18/2026 05:06");
    assert.equal(output.getCell("B73").value, "");
    assert.equal(output.getCell("C73").value, 4);
    assert.equal(output.getCell("D73").value, `${unit} sự kiện 2`);
  });
}
