import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { CTKTKT_TEMPLATE_BASE64 } from "../lib/ctktkt-template.generated.ts";
import {
  applyCtktktDailyCarryovers,
  ctktktDateLabelCells,
  ctktktExportCell,
  prepareCtktktDaySheet,
  prepareCtktktPreviousMonthSheet,
} from "../lib/ctktkt-export-layout.ts";

async function loadTemplate() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(atob(CTKTKT_TEMPLATE_BASE64), character => character.charCodeAt(0)).buffer);
  return workbook;
}

const formula = cell => cell.value?.formula ?? null;

test("day sheets write cumulative steam to the template's row 55 and drop its sample values", async () => {
  const sheet = (await loadTemplate()).getWorksheet("24");
  assert.equal(sheet.getCell("W55").value, 8418.28, "template ships sample steam values");
  assert.equal(formula(sheet.getCell("W56")), "W55");

  prepareCtktktDaySheet(sheet, "25");
  for (const column of ["W", "AB", "AG", "AL"]) assert.equal(sheet.getCell(`${column}55`).value, null);
  for (const cell of ["W49", "X49", "AG49", "AH49"]) assert.equal(sheet.getCell(cell).value, null);

  const s2 = { AG54: 8147.96, AH54: 13680.29, AI54: 19944.19, AJ54: 27439.38, AK54: 35021.28, AL54: 39008 };
  for (const [cell, value] of Object.entries(s2)) sheet.getCell(ctktktExportCell(cell, true)).value = value;
  assert.equal(sheet.getCell("AL55").value, 39008);
  assert.equal(sheet.getCell("AF54").value, "S2", "header row must stay intact");
  assert.equal(formula(sheet.getCell("AJ59")), "AL55");
  assert.equal(formula(sheet.getCell("Y59")), "AB56+'25'!W55");
  assert.equal(formula(sheet.getCell("AI59")), "AL56+'25'!AG55");
  assert.deepEqual(ctktktDateLabelCells(true), ["Z58", "AJ58"]);
  assert.equal(ctktktExportCell("AG54", false), "AG54", "d-1 keeps the source layout");

  prepareCtktktDaySheet(sheet, null);
  assert.equal(formula(sheet.getCell("Y59")), "AB56");
});

test("previous-month sheet links its night shift to day 01 instead of an external workbook", async () => {
  const sheet = (await loadTemplate()).getWorksheet("d-1");
  prepareCtktktPreviousMonthSheet(sheet, "01");
  assert.equal(formula(sheet.getCell("Y58")), "AB55+'01'!W55");
  assert.equal(formula(sheet.getCell("AI58")), "AL55+'01'!AG55");
});

test("daily carryovers follow the 23-24/09/2026 source workbook rules", async () => {
  const sheet = (await loadTemplate()).getWorksheet("24");
  const previousRow = { "KTKT:X72": "2668.13", "KTKT:X73": "22574.94" };
  const row = { "KTKT:X72": "3420.27", "KTKT:X73": "23346.92", "KTKT:I36": "6500" };
  applyCtktktDailyCarryovers(sheet, row, previousRow, "23");

  assert.equal(formula(sheet.getCell("W86")), "'23'!W89", "coal stock D-1 = W89 of the previous day");
  assert.equal(formula(sheet.getCell("W89")), "W86+W87-W88");
  assert.equal(sheet.getCell("W87").value, null, "W87 is entered after 06h, never derived from I36");
  assert.equal(sheet.getCell("W72").value, 2668.13);
  assert.equal(sheet.getCell("W73").value, 22574.94);
  assert.equal(formula(sheet.getCell("P74")), "P69+P70+P71");
  assert.equal(formula(sheet.getCell("P75")), "P73+P72-P74");
});

test("entered values are never overwritten by carryovers", async () => {
  const sheet = (await loadTemplate()).getWorksheet("24");
  sheet.getCell("W72").value = 2600;
  sheet.getCell("W87").value = 4088.86;
  sheet.getCell("P74").value = 138.977;
  const row = { "KTKT:W72": "2600", "KTKT:W87": "4088.86", "KTKT:P74": "138.977", "KTKT:I36": "7888.86" };
  applyCtktktDailyCarryovers(sheet, row, { "KTKT:X72": "2668.13" }, "23");

  assert.equal(sheet.getCell("W72").value, 2600);
  assert.equal(sheet.getCell("W87").value, 4088.86);
  assert.equal(sheet.getCell("P74").value, 138.977);
});

test("sanitized template has no external links, typos or kg-based S2 oil and still round-trips", async () => {
  const { sanitizeCtktktTemplate } = await import("../lib/ctktkt-export-layout.ts");
  const workbook = await loadTemplate();
  sanitizeCtktktTemplate(workbook);
  const problems = [];
  for (const sheet of workbook.worksheets) sheet.eachRow(row => row.eachCell(cell => {
    const f = cell.formula;
    if (f && (/\[\d+\]/.test(f) || f.includes("E1360"))) problems.push(`${sheet.name}!${cell.address}`);
  }));
  assert.deepEqual(problems, []);
  const day = workbook.getWorksheet("23");
  assert.equal(formula(day.getCell("G4")), "AL13/1000");
  assert.equal(formula(day.getCell("G5")), "AL14/1000");
  assert.equal(formula(day.getCell("P169")), "'16'!T191");
  assert.equal(day.getCell("B144").value, "Phần trăm điện tự dùng (%)");
  assert.equal(formula(day.getCell("H144")), "(H143/H138)*100");
  assert.equal(formula(day.getCell("H145")), "((H138-H139)/H138)*100");
  assert.equal(workbook.getWorksheet("d-1").getCell("J19").value, null, "month-to-date restarts on day 01");
  assert.equal(formula(workbook.getWorksheet("01").getCell("J6")), "I6+'d-1'!J6");

  const reloaded = new ExcelJS.Workbook();
  await reloaded.xlsx.load(await workbook.xlsx.writeBuffer());
  assert.equal(reloaded.getWorksheet("23").getCell("I145").formula.includes("E139"), true);
});

test("night shift uses day D+1 for electricity, coal and steam, and rates use rows 41/42", async () => {
  const sheet = (await loadTemplate()).getWorksheet("23");
  prepareCtktktDaySheet(sheet, "24");
  assert.equal(formula(sheet.getCell("Y41")), "'24'!W8-AA8");
  assert.equal(formula(sheet.getCell("AI44")), "'24'!AG11-AK11");
  assert.equal(formula(sheet.getCell("Y46")), "AB28+'24'!W28");
  assert.equal(formula(sheet.getCell("AI46")), "AL28+'24'!AG28");
  assert.equal(formula(sheet.getCell("Y60")), "(Y59*10^6)/(Y41*1000)");
  assert.equal(formula(sheet.getCell("AI61")), "(AI59*10^6)/(AI42*1000)");

  prepareCtktktDaySheet(sheet, null);
  assert.equal(formula(sheet.getCell("Y41")), "AB8-AA8");
  assert.equal(formula(sheet.getCell("Y46")), "AB28");
});

test("auxiliary power adds grid-received electricity and grinding balls default to 150", async () => {
  const sheet = (await loadTemplate()).getWorksheet("23");
  applyCtktktDailyCarryovers(sheet, { GRID_RECEIVE_S1: "221.5648" }, undefined, "22");
  assert.equal(formula(sheet.getCell("L157")), "J157-K157+221.5648");
  assert.equal(formula(sheet.getCell("L158")), "J158-K158");
  assert.equal(sheet.getCell("E39").value, 150);
  assert.equal(sheet.getCell("H39").value, 150);
});

test("W86 keeps the value entered on day 01 and chains on later days", async () => {
  const workbook = await loadTemplate();
  const first = workbook.getWorksheet("01");
  first.getCell("W86").value = 245431.88997158478;
  applyCtktktDailyCarryovers(first, { "KTKT:W86": "245431.88997158478" }, undefined, "d-1");
  assert.equal(first.getCell("W86").value, 245431.88997158478);

  const later = workbook.getWorksheet("02");
  applyCtktktDailyCarryovers(later, { "KTKT:W86": "1" }, undefined, "01");
  assert.equal(formula(later.getCell("W86")), "'01'!W89");
});

test("operating hours carry the latest entered value", async () => {
  const { applyCtktktCarriedValues } = await import("../lib/ctktkt-export-layout.ts");
  const sheet = (await loadTemplate()).getWorksheet("23");
  applyCtktktCarriedValues(sheet, ["W68", "W69"], new Map([["W68", 53289.1887]]));
  assert.equal(sheet.getCell("W68").value, 53289.1887);
});
