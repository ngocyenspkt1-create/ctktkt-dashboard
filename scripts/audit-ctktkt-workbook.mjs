import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

import { CTKTKT_INPUT_FIELDS } from "../lib/ctktkt-fields.generated.ts";
import { CTKTKT_EXTRA_INPUT_FIELDS } from "../lib/ctktkt-extra-fields.ts";
import { CTKTKT_BCSX_LINKS, CTKTKT_BCSX_LINKED_CELLS } from "../lib/ctktkt-bcsx-link.ts";
import {
  calculateCtktktSummary,
  calculateNh3Summary,
  calculateOilDifferences,
  calculateSteamDifferences,
  calculateTkdDcsSummary,
} from "../lib/ctktkt-report.ts";

function argument(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const workbookPath = argument("--workbook");
const sourceWorkbook = argument("--source-workbook", workbookPath);
const month = argument("--month", "2026-09");
const throughDay = Number(argument("--through", "19"));
const outputPath = argument("--output");

if (!workbookPath || !outputPath || !/^\d{4}-\d{2}$/.test(month) || !Number.isInteger(throughDay) || throughDay < 1 || throughDay > 31) {
  throw new Error("Usage: node scripts/audit-ctktkt-workbook.mjs --workbook <xlsx> --month YYYY-MM --through DD --output <json>");
}

function cellValue(cell) {
  const value = cell.value;
  if (value && typeof value === "object" && ("formula" in value || "sharedFormula" in value)) return value.result ?? null;
  return value;
}

function directCellValue(cell) {
  const value = cell.value;
  if (value && typeof value === "object" && ("formula" in value || "sharedFormula" in value)) return { isFormula: true, value: null };
  return { isFormula: false, value };
}

function numeric(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).trim().replaceAll(" ", "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function storageValue(value) {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  return String(value).trim();
}

function previousDate(monthText) {
  const [year, monthNumber] = monthText.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1, 1));
  date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}

function expectedNumber(sheet, address) {
  const cell = sheet.getCell(address);
  const result = numeric(cellValue(cell));
  if (result !== null) return result;
  const value = cell.value;
  return value && typeof value === "object" && ("formula" in value || "sharedFormula" in value) ? 0 : null;
}

function closeEnough(actual, expected) {
  if (actual === null || expected === null) return actual === expected;
  const tolerance = Math.max(1e-8, Math.abs(expected) * 1e-10);
  return Math.abs(actual - expected) <= tolerance;
}

function auditDay(sheet, entries, previousEntries) {
  const checks = [];
  const add = (name, sourceCell, actual, expectedDivisor = 1) => {
    const rawExpected = expectedNumber(sheet, sourceCell);
    const expected = rawExpected === null ? null : rawExpected / expectedDivisor;
    checks.push({ name, sourceCell, expected, actual, passed: closeEnough(actual, expected) });
  };

  const summary = calculateCtktktSummary(entries, previousEntries);
  const summaryMappings = [
    ["S1 sản lượng đầu cực", "E20", summary.s1.grossMwh],
    ["S2 sản lượng đầu cực", "H20", summary.s2.grossMwh],
    ["NM sản lượng đầu cực", "I20", summary.plant.grossMwh],
    ["S1 sản lượng phát lưới", "E21", summary.s1.netMwh],
    ["S2 sản lượng phát lưới", "H21", summary.s2.netMwh],
    ["NM sản lượng phát lưới", "I21", summary.plant.netMwh],
    ["S1 điện tự dùng", "E25", summary.s1.auxiliaryMwh],
    ["S2 điện tự dùng", "H25", summary.s2.auxiliaryMwh],
    ["NM điện tự dùng", "I25", summary.plant.auxiliaryMwh],
    ["S1 tỷ lệ tự dùng gồm tổn thất MBA", "E27", summary.s1.auxiliaryPercent],
    ["S2 tỷ lệ tự dùng gồm tổn thất MBA", "H27", summary.s2.auxiliaryPercent],
    ["NM tỷ lệ tự dùng gồm tổn thất MBA", "I27", summary.plant.auxiliaryPercent],
    ["S1 than nguyên trạng", "E19", summary.s1.rawCoalTonnes],
    ["S2 than nguyên trạng", "H19", summary.s2.rawCoalTonnes],
    ["NM than nguyên trạng", "I19", summary.plant.rawCoalTonnes],
    ["S1 than quy ẩm", "AR87", summary.s1.adjustedCoalTonnes],
    ["S2 than quy ẩm", "AR90", null],
    ["NM than quy ẩm", "AR86", summary.plant.adjustedCoalTonnes],
    ["S1 nhiệt trị", "AT87", summary.s1.hhvKjKg ?? null],
    ["S2 nhiệt trị", "AT87", summary.s2.hhvKjKg ?? null],
    ["NM nhiệt trị", "AT87", summary.plant.hhvKjKg ?? null],
    ["S1 suất hao than", "AU87", summary.s1.netCoalRate],
    ["S2 suất hao than", "AU88", summary.s2.netCoalRate],
    ["NM suất hao than", "AU86", summary.plant.netCoalRate],
    ["S1 suất hao nhiệt", "AV87", summary.s1.netHeatRate],
    ["S2 suất hao nhiệt", "AV88", summary.s2.netHeatRate],
    ["NM suất hao nhiệt", "AV86", summary.plant.netHeatRate],
  ];
  for (const [name, cell, actual] of summaryMappings) {
    if (name === "S2 than quy ẩm") {
      const s2Expected = ["AR90", "AR91", "AR92"].map(address => expectedNumber(sheet, address));
      const expected = s2Expected.some(value => value === null) ? null : s2Expected.reduce((sum, value) => sum + value, 0);
      checks.push({ name, sourceCell: "SUM(AR90:AR92)", expected, actual: summary.s2.adjustedCoalTonnes, passed: closeEnough(summary.s2.adjustedCoalTonnes, expected) });
    } else if (name === "S1 than quy ẩm") {
      const s1Expected = ["AR87", "AR88", "AR89"].map(address => expectedNumber(sheet, address));
      const expected = s1Expected.some(value => value === null) ? null : s1Expected.reduce((sum, value) => sum + value, 0);
      checks.push({ name, sourceCell: "SUM(AR87:AR89)", expected, actual, passed: closeEnough(actual, expected) });
    } else add(name, cell, actual);
  }

  const tkd = calculateTkdDcsSummary(entries);
  const tkdRows = [
    ["pSumTdS1", 11], ["pSumTdS2", 14], ["pSumS1S2", 17], ["pSumT1T2", 18], ["qSumS1S2", 19],
  ];
  for (const column of ["M", "N", "O", "P", "Q", "R"]) {
    for (const [property, row] of tkdRows) add(`TKĐ ${property} ${column}`, `${column}${row}`, tkd[column][property]);
  }

  const oil1 = calculateOilDifferences(entries, "s1", previousEntries);
  const oil2 = calculateOilDifferences(entries, "s2", previousEntries);
  ["W", "X", "Y", "Z", "AA", "AB"].forEach((column, index) => add(`Dầu S1 ${oil1[index].label}`, `${column}15`, oil1[index].diff));
  ["AG", "AH", "AI", "AJ", "AK", "AL"].forEach((column, index) => add(`Dầu S2 ${oil2[index].label}`, `${column}15`, oil2[index].diff, 1000));

  const steam1 = calculateSteamDifferences(entries, "s1");
  const steam2 = calculateSteamDifferences(entries, "s2");
  const steamInputRow = Array.from({ length: 12 }, (_, index) => 50 + index)
    .find(row => sheet.getCell(`V${row}`).text.trim() === "Tổng lưu lượng hơi") ?? 54;
  const steamResultRow = steamInputRow + 1;
  ["W", "X", "Y", "Z", "AA", "AB"].forEach((column, index) => add(`Hơi S1 ${steam1[index].label}`, `${column}${steamResultRow}`, steam1[index].consumption));
  ["AG", "AH", "AI", "AJ", "AK", "AL"].forEach((column, index) => add(`Hơi S2 ${steam2[index].label}`, `${column}${steamResultRow}`, steam2[index].consumption));

  const nh3 = calculateNh3Summary(entries, summary.plant.grossMwh, summary.plant.netMwh);
  [69, 70, 71].forEach((row, index) => add(`NH3 bồn ${index + 1} khả dụng 95%`, `Q${row}`, nh3.tankAvailable[index]));
  add("NH3 tồn 24h", "P74", nh3.stock24h);
  add("NH3 tiêu thụ", "P75", nh3.usedTonnes);
  add("Suất hao NH3 đầu cực", "P77", nh3.rateGross);
  add("Suất hao NH3 phát lưới", "Q77", nh3.rateNet);

  return checks;
}

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(fs.readFileSync(workbookPath));

const allInputCells = [...new Set([
  ...[...CTKTKT_INPUT_FIELDS, ...CTKTKT_EXTRA_INPUT_FIELDS].map(field => field.cell),
  ...CTKTKT_BCSX_LINKED_CELLS,
])];
const manualCells = allInputCells.filter(cell => !CTKTKT_BCSX_LINKED_CELLS.has(cell));
const previous = previousDate(month);
const sheetDates = [{ sheetName: "d-1", date: previous }];
for (let day = 1; day <= throughDay; day += 1) sheetDates.push({ sheetName: String(day).padStart(2, "0"), date: `${month}-${String(day).padStart(2, "0")}` });

const days = [];
const entriesByDate = new Map();
const warnings = [];

for (const { sheetName, date } of sheetDates) {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new Error(`Missing worksheet ${sheetName}`);
  const entries = {};
  for (const cell of allInputCells) {
    const value = directCellValue(sheet.getCell(cell));
    if (value.isFormula) {
      warnings.push({ date, sheetName, cell, message: "Ô nằm trong danh sách nhập nhưng sheet này chứa công thức; đã bỏ qua để không ghi đè công thức." });
      continue;
    }
    const text = storageValue(value.value);
    if (text !== "") entries[cell] = text;
  }

  // The source workbook stores some coal-scale corrections as numeric constants
  // embedded inside the formulas of X/Z/AB28 and AH/AJ/AL28. The web keeps those
  // corrections in explicit editable cells so they are auditable and are not
  // accidentally applied twice. Recover the constant as: Excel result - raw delta.
  const priorDateValue = new Date(`${date}T12:00:00Z`);
  priorDateValue.setUTCDate(priorDateValue.getUTCDate() - 1);
  const priorEntries = entriesByDate.get(priorDateValue.toISOString().slice(0, 10));
  const meterTotal = (source, column) => {
    const values = Array.from({ length: 12 }, (_, index) => numeric(source?.[`${column}${16 + index}`]));
    return values.some(value => value === null) ? null : values.reduce((sum, value) => sum + value, 0);
  };
  const recoverCorrections = (columns, correctionCells) => {
    const [first, second, end] = columns;
    const raw = [
      priorEntries ? (() => {
        const currentTotal = meterTotal(entries, first);
        const priorTotal = meterTotal(priorEntries, end);
        return currentTotal === null || priorTotal === null ? null : currentTotal - priorTotal;
      })() : null,
      (() => {
        const currentTotal = meterTotal(entries, second);
        const priorTotal = meterTotal(entries, first);
        return currentTotal === null || priorTotal === null ? null : currentTotal - priorTotal;
      })(),
      (() => {
        const currentTotal = meterTotal(entries, end);
        const priorTotal = meterTotal(entries, second);
        return currentTotal === null || priorTotal === null ? null : currentTotal - priorTotal;
      })(),
    ];
    [first, second, end].forEach((resultColumn, index) => {
      const expected = expectedNumber(sheet, `${resultColumn}28`);
      if (expected !== null && raw[index] !== null) entries[correctionCells[index]] = String(expected - raw[index]);
    });
  };
  recoverCorrections(["X", "Z", "AB"], ["W28", "Y28", "AA28"]);
  recoverCorrections(["AH", "AJ", "AL"], ["AG28", "AI28", "AK28"]);
  const steamInputRow = Array.from({ length: 12 }, (_, index) => 50 + index)
    .find(row => sheet.getCell(`V${row}`).text.trim() === "Tổng lưu lượng hơi") ?? 54;
  if (steamInputRow !== 54) {
    for (const column of ["W", "X", "Y", "Z", "AA", "AB", "AG", "AH", "AI", "AJ", "AK", "AL"]) {
      const value = directCellValue(sheet.getCell(`${column}${steamInputRow}`));
      if (!value.isFormula) entries[`${column}54`] = storageValue(value.value);
    }
  }
  entriesByDate.set(date, entries);

  const manualEntries = manualCells.map(cell => ({ cell, value: entries[cell] ?? "" }));
  const shiftEntries = [];
  for (const link of CTKTKT_BCSX_LINKS) {
    const value = entries[link.cell] ?? "";
    if (link.unit === "S1/S2") {
      shiftEntries.push({ unit: "S1", timeSlot: link.timeSlot, metric: link.metric, value });
      shiftEntries.push({ unit: "S2", timeSlot: link.timeSlot, metric: link.metric, value });
    } else {
      shiftEntries.push({ unit: link.unit, timeSlot: link.timeSlot, metric: link.metric, value });
    }
  }
  days.push({ date, sheetName, manualEntries, shiftEntries });
}

const audits = [];
for (const { sheetName, date } of sheetDates.slice(1)) {
  const sheet = workbook.getWorksheet(sheetName);
  const current = entriesByDate.get(date);
  const currentDate = new Date(`${date}T12:00:00Z`);
  currentDate.setUTCDate(currentDate.getUTCDate() - 1);
  const priorDate = currentDate.toISOString().slice(0, 10);
  const checks = auditDay(sheet, current, entriesByDate.get(priorDate));
  audits.push({ date, total: checks.length, passed: checks.filter(check => check.passed).length, failed: checks.filter(check => !check.passed) });
}

const report = {
  sourceWorkbook: path.resolve(sourceWorkbook),
  month,
  throughDay,
  fieldCounts: { allInputCells: allInputCells.length, manualCells: manualCells.length, linkedCells: CTKTKT_BCSX_LINKED_CELLS.size },
  warnings,
  days,
  audits,
  totals: {
    dates: days.length,
    manualCellsPrepared: days.reduce((total, day) => total + day.manualEntries.length, 0),
    nonBlankManualValues: days.reduce((total, day) => total + day.manualEntries.filter(entry => entry.value !== "").length, 0),
    shiftCellsPrepared: days.reduce((total, day) => total + day.shiftEntries.length, 0),
    checks: audits.reduce((total, audit) => total + audit.total, 0),
    passed: audits.reduce((total, audit) => total + audit.passed, 0),
    failed: audits.reduce((total, audit) => total + audit.failed.length, 0),
  },
};

fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ outputPath: path.resolve(outputPath), ...report.totals, warnings: warnings.length }, null, 2));
