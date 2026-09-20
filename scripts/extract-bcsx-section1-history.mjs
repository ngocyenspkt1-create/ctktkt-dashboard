import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

import { SHIFT_METRICS, SHIFT_TIME_SLOTS } from "../lib/bcsx.ts";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

const s1Path = argument("--s1");
const s2Path = argument("--s2");
const month = argument("--month");
const throughDay = Number(argument("--through"));
const outputPath = argument("--output");

if (!s1Path || !s2Path || !/^\d{4}-\d{2}$/.test(month) || !Number.isInteger(throughDay) || throughDay < 1 || throughDay > 31 || !outputPath) {
  throw new Error("Usage: node scripts/extract-bcsx-section1-history.mjs --s1 <xlsx> --s2 <xlsx> --month YYYY-MM --through DD --output <json>");
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

function storageValue(cell, address) {
  const raw = cell.value;
  if (raw && typeof raw === "object" && ("formula" in raw || "sharedFormula" in raw)) {
    throw new Error(`${address} là công thức; Mục 1 phải là dữ liệu nhập tay.`);
  }
  if (typeof raw !== "number" || !Number.isFinite(raw)) throw new Error(`${address} không phải số hợp lệ.`);
  return String(raw);
}

function sourceTime(cell) {
  if (cell.value instanceof Date) return `${String(cell.value.getUTCHours()).padStart(2, "0")}:${String(cell.value.getUTCMinutes()).padStart(2, "0")}`;
  const match = String(cell.value ?? "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) throw new Error(`${cell.address} không có mốc giờ hợp lệ.`);
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

async function loadSource(filePath, unit) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const byDate = new Map();
  for (let day = 1; day <= throughDay; day += 1) {
    const sheetName = String(day).padStart(2, "0");
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) throw new Error(`${path.basename(filePath)} thiếu sheet ${sheetName}.`);
    const date = `${month}-${sheetName}`;
    const entries = [];
    for (let index = 0; index < SHIFT_TIME_SLOTS.length; index += 1) {
      const row = 11 + index;
      const actualTime = sourceTime(sheet.getCell(`A${row}`));
      const expectedTime = SHIFT_TIME_SLOTS[index];
      if (actualTime !== expectedTime) throw new Error(`${path.basename(filePath)}!${sheetName}!A${row}: mốc ${actualTime}, cần ${expectedTime}.`);
      for (const metric of SHIFT_METRICS) {
        const address = `${metric.col}${row}`;
        entries.push({ unit, timeSlot: expectedTime, metric: metric.key, value: storageValue(sheet.getCell(address), `${path.basename(filePath)}!${sheetName}!${address}`) });
      }
    }
    byDate.set(date, entries);
  }
  return byDate;
}

const [s1, s2] = await Promise.all([loadSource(s1Path, "S1"), loadSource(s2Path, "S2")]);
const days = [];
for (let day = 1; day <= throughDay; day += 1) {
  const date = `${month}-${String(day).padStart(2, "0")}`;
  const entries = [...(s1.get(date) || []), ...(s2.get(date) || [])];
  if (entries.length !== 384) throw new Error(`${date}: cần đúng 384 giá trị Mục 1, nhận ${entries.length}.`);
  const unique = new Set(entries.map(entry => `${entry.unit}|${entry.timeSlot}|${entry.metric}`));
  if (unique.size !== entries.length) throw new Error(`${date}: có khóa Mục 1 trùng nhau.`);
  days.push({ date, entries });
}

const packageData = {
  kind: "BCSX_SECTION_1_HISTORY",
  version: 1,
  month,
  throughDay,
  sources: [
    { unit: "S1", fileName: path.basename(s1Path), sha256: sha256(s1Path) },
    { unit: "S2", fileName: path.basename(s2Path), sha256: sha256(s2Path) },
  ],
  totals: { days: days.length, entries: days.reduce((sum, item) => sum + item.entries.length, 0), checks: days.reduce((sum, item) => sum + item.entries.length, 0), passed: days.reduce((sum, item) => sum + item.entries.length, 0), failed: 0 },
  days,
};

fs.writeFileSync(outputPath, JSON.stringify(packageData, null, 2));
console.log(JSON.stringify({ outputPath: path.resolve(outputPath), ...packageData.totals, sources: packageData.sources }, null, 2));
