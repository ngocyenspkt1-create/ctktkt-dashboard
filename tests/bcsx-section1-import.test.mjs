import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { buildSection1ImportPackage, identifySection1Workbook } from "../lib/bcsx-section1-import.ts";
import { SHIFT_METRICS, SHIFT_TIME_SLOTS } from "../lib/bcsx.ts";

async function workbookBytes(multiplier) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("01");
  SHIFT_TIME_SLOTS.forEach((time, index) => {
    const row = 11 + index;
    sheet.getCell(`A${row}`).value = time;
    SHIFT_METRICS.forEach((metric, metricIndex) => {
      sheet.getCell(`${metric.col}${row}`).value = multiplier * 1000 + index * 10 + metricIndex;
    });
  });
  return (await workbook.xlsx.writeBuffer()).buffer;
}

test("Nhận diện đúng file BCSX S1/S2 và ngày báo cáo từ tên file", () => {
  assert.deepEqual(identifySection1Workbook("BCSX_NMD S1 19.09.2026.xlsx"), { unit: "S1", month: "2026-09", throughDay: 19 });
  assert.deepEqual(identifySection1Workbook("BCSX_NMD_S2_19.09.2026.xlsx"), { unit: "S2", month: "2026-09", throughDay: 19 });
  assert.throws(() => identifySection1Workbook("BCSX_NMD_19.09.2026.xlsx"), /S1\/S2/);
});

test("Tạo gói Mục 1 từ đúng hai workbook S1 và S2", async () => {
  const result = await buildSection1ImportPackage([
    { fileName: "BCSX_NMD S1 01.09.2026.xlsx", bytes: await workbookBytes(1) },
    { fileName: "BCSX_NMD S2 01.09.2026.xlsx", bytes: await workbookBytes(2) },
  ]);
  assert.equal(result.month, "2026-09");
  assert.equal(result.throughDay, 1);
  assert.equal(result.days.length, 1);
  assert.equal(result.days[0].entries.length, 384);
  assert.equal(result.totals.entries, 384);
  assert.equal(result.days[0].entries[0].unit, "S1");
  assert.equal(result.days[0].entries[192].unit, "S2");
});

test("Từ chối khi không chọn đủ một file S1 và một file S2", async () => {
  const bytes = await workbookBytes(1);
  await assert.rejects(
    buildSection1ImportPackage([
      { fileName: "BCSX_NMD S1 01.09.2026.xlsx", bytes },
      { fileName: "BCSX_NMD S1 01.09.2026.xlsx", bytes },
    ]),
    /một file S1 và một file S2/,
  );
});
