import ExcelJS from "exceljs";
import { getRawDb } from "@/db";
import { calculateDailyProduction } from "@/lib/daily-production-calculations";
import { CTKTKT_BCSX_LINKED_CELLS, deriveCtktktCellsFromBcsx, type CtktktBcsxReading } from "@/lib/ctktkt-bcsx-link";
import { CTKTKT_WATER_LINKED_CELLS, ctktktWaterLogFromRow, deriveCtktktCellsFromWater } from "@/lib/ctktkt-water-link";
import { CTKTKT_DAY03_INPUT_CELLS } from "@/lib/ctktkt-fields.generated";
import { CTKTKT_EXTRA_INPUT_FIELDS, CTKTKT_NON_WORKBOOK_INPUT_CELLS, CTKTKT_OPERATING_HOURS_CELLS, getCtktktCoalAdjustmentNotes, getCtktktWaterAdjustments } from "@/lib/ctktkt-extra-fields";
import { CTKTKT_TEMPLATE_BASE64 } from "@/lib/ctktkt-template.generated";
import { ensureWaterSchema } from "@/lib/water-report/schema";
import { CTKTKT_INSTALLED_CAPACITY_CELL, CTKTKT_INSTALLED_CAPACITY_MW } from "@/lib/ctktkt-defaults";
import { deriveNh3StartLevels, type CtktktDayEntries } from "@/lib/ctktkt-report";
import { applyCtktktStartupEventMetadata } from "@/lib/ctktkt-startup-event";
import {
  applyCtktktCarriedValues,
  applyCtktktCoalAdjustmentTotals,
  applyCtktktDailyCarryovers,
  CTKTKT_GRINDING_BALL_DEFAULT,
  ctktktDateLabelCells,
  ctktktExportCell,
  prepareCtktktDaySheet,
  prepareCtktktPreviousMonthSheet,
  sanitizeCtktktTemplate,
} from "@/lib/ctktkt-export-layout";

const periodPattern = /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/;

function monthBounds(period: string) {
  const [year, month] = period.split("-").map(Number);
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const previousDate = new Date(`${period}-01T12:00:00+07:00`);
  previousDate.setDate(previousDate.getDate() - 1);
  const previous = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(previousDate);
  return { year, month, previous, next };
}

function numeric(value: string | undefined) {
  if (!value?.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function setNumber(sheet: ExcelJS.Worksheet, cell: string, value: number | null) {
  if (value !== null && Number.isFinite(value)) sheet.getCell(cell).value = value;
}

function ktktCells(row: Record<string, string> | undefined): CtktktDayEntries {
  const entries: CtktktDayEntries = {};
  for (const [code, value] of Object.entries(row || {})) {
    if (code.startsWith("KTKT:")) entries[code.slice(5)] = value;
  }
  return entries;
}

function applyNh3StartLevelCarryover(
  sheet: ExcelJS.Worksheet,
  previousRow: Record<string, string> | undefined,
) {
  for (const [cell, value] of Object.entries(deriveNh3StartLevels(ktktCells(previousRow)))) {
    setNumber(sheet, cell, numeric(value));
  }
}

function applyCoalAdjustmentNotes(sheet: ExcelJS.Worksheet, row: Record<string, string>) {
  for (const [cell, note] of Object.entries(getCtktktCoalAdjustmentNotes(row))) sheet.getCell(cell).note = note;
}

function applyWaterAdjustments(sheet: ExcelJS.Worksheet, row: Record<string, string>) {
  const { adjS1, adjS2, noteS1, noteS2 } = getCtktktWaterAdjustments(row);
  if (adjS1 !== 0) {
    sheet.getCell("Y72").value = { formula: `X72-W72+(${adjS1})` };
  }
  if (noteS1) {
    sheet.getCell("Y72").note = `Lý do hiệu chỉnh nước S1: ${noteS1}`;
  }
  if (adjS2 !== 0) {
    sheet.getCell("Y73").value = { formula: `(X73-W73)+(${adjS2})` };
  }
  if (noteS2) {
    sheet.getCell("Y73").note = `Lý do hiệu chỉnh nước S2: ${noteS2}`;
  }
}

function fillDailyFallbacks(sheet: ExcelJS.Worksheet, row: Record<string, string>) {
  setNumber(sheet, CTKTKT_INSTALLED_CAPACITY_CELL, Number(CTKTKT_INSTALLED_CAPACITY_MW));
  const value = (code: string) => numeric(row[code]);
  const B = value("B"), C = value("C"), H = value("H"), I = value("I");
  const AE = value("AE"), AF = value("AF"), AJ = value("AJ"), CJ = value("CJ");
  setNumber(sheet, "J157", B === null ? null : B * 1000);
  setNumber(sheet, "K157", C === null ? null : C * 1000);
  setNumber(sheet, "J158", H === null ? null : H * 1000);
  setNumber(sheet, "K158", I === null ? null : I * 1000);
  if (CJ !== null) for (const target of ["AJ87", "AJ88", "AJ89", "AJ90", "AJ91", "AJ92"]) setNumber(sheet, target, CJ);
  if (AJ !== null) {
    const dryKcal = AJ / 4.1868 / (CJ === null ? 1 : 1 - CJ / 100);
    for (const target of ["AK87", "AK88", "AK89", "AK90", "AK91", "AK92"]) setNumber(sheet, target, dryKcal);
  }
  const calculated = calculateDailyProduction(row);
  setNumber(sheet, "D181", B === null || H === null ? null : B + H);
  setNumber(sheet, "F181", C === null || I === null ? null : C + I);
  setNumber(sheet, "K181", calculated.P === null ? null : calculated.P / 1000);
  setNumber(sheet, "L181", calculated.Q);
  setNumber(sheet, "M181", AE === null || AF === null ? null : (AE + AF) / 1_000_000);
  setNumber(sheet, "N181", calculated.U);
  setNumber(sheet, "O181", calculated.AA);
  setNumber(sheet, "P181", calculated.V);
  setNumber(sheet, "Q181", calculated.W);
}

function applyDateLabels(sheet: ExcelJS.Worksheet, date: string, isDaySheet: boolean) {
  const display = date.split("-").reverse().join("/");
  for (const cell of ctktktDateLabelCells(isDaySheet)) sheet.getCell(cell).value = display;
  sheet.getCell("AE83").value = `Ngày ${display.slice(0, 5)}`;
  sheet.getCell("N68").value = `Mức bồn 00h00 ${display}`;
  sheet.getCell("O68").value = `Mức bồn 24h00 ${display}`;
}

function normalizeCoalMeterFormulas(sheet: ExcelJS.Worksheet, previousSheetName: string) {
  const previous = `'${previousSheetName.replaceAll("'", "''")}'`;
  sheet.getCell("X28").value = { formula: `SUM(X16:X27)-SUM(${previous}!AB16:AB27)` };
  sheet.getCell("Z28").value = { formula: "SUM(Z16:Z27)-SUM(X16:X27)" };
  sheet.getCell("AB28").value = { formula: "SUM(AB16:AB27)-SUM(Z16:Z27)" };
  sheet.getCell("AH28").value = { formula: `SUM(AH16:AH27)-SUM(${previous}!AL16:AL27)` };
  sheet.getCell("AJ28").value = { formula: "SUM(AJ16:AJ27)-SUM(AH16:AH27)" };
  sheet.getCell("AL28").value = { formula: "SUM(AL16:AL27)-SUM(AJ16:AJ27)" };
}

export async function GET(request: Request) {
  const period = new URL(request.url).searchParams.get("period") || "";
  if (!periodPattern.test(period)) return Response.json({ error: "Tháng không hợp lệ." }, { status: 400 });
  try {
    const { year, month, previous, next } = monthBounds(period);
    const db = getRawDb();
    await ensureWaterSchema(db);
    const hourCodes = CTKTKT_OPERATING_HOURS_CELLS.map(cell => `KTKT:${cell}`);
    const [{ results }, { results: shiftResults }, { results: waterResults }, { results: earlierHours }] = await Promise.all([
      db.prepare(
        "SELECT operating_date AS operatingDate, field_code AS fieldCode, value FROM daily_inputs WHERE operating_date >= ? AND operating_date < ? ORDER BY operating_date, field_code",
      ).bind(previous, next).all(),
      db.prepare(
        "SELECT operating_date AS operatingDate, unit, time_slot AS timeSlot, metric, value FROM shift_readings WHERE operating_date >= ? AND operating_date < ? ORDER BY operating_date, unit, time_slot, metric",
      ).bind(previous, next).all(),
      db.prepare(
        "SELECT log_date AS logDate, shift_time AS shiftTime, water_rec_s1 AS waterRecS1, water_rec_s2 AS waterRecS2, resin_water_s1_24h AS resinWaterS1_24h, resin_water_s2_24h AS resinWaterS2_24h FROM water_shift_logs WHERE log_date >= ? AND log_date < ? ORDER BY log_date, CASE shift_time WHEN '06h00' THEN 1 WHEN '14h00' THEN 2 WHEN '22h00' THEN 3 ELSE 9 END",
      ).bind(previous, next).all(),
      // Operating hours persist until someone enters a new value, possibly in an earlier month.
      db.prepare(
        `SELECT field_code AS fieldCode, value FROM daily_inputs WHERE operating_date < ? AND field_code IN (${hourCodes.map(() => "?").join(", ")}) ORDER BY operating_date`,
      ).bind(previous, ...hourCodes).all(),
    ]);

    const byDate = new Map<string, Record<string, string>>();
    for (const item of results as { operatingDate: string; fieldCode: string; value: string }[]) {
      const row = byDate.get(item.operatingDate) || {};
      row[item.fieldCode] = item.value;
      byDate.set(item.operatingDate, row);
    }
    const readingsByDate = new Map<string, CtktktBcsxReading[]>();
    for (const reading of shiftResults as CtktktBcsxReading[]) {
      const date = reading.operatingDate || "";
      const list = readingsByDate.get(date) || [];
      list.push(reading);
      readingsByDate.set(date, list);
    }
    const waterLogs = (waterResults as Record<string, unknown>[]).map(ctktktWaterLogFromRow);

    const latestHours = new Map<string, number>();
    const rememberHours = (row: Record<string, string> | undefined) => {
      for (const cell of CTKTKT_OPERATING_HOURS_CELLS) {
        const value = numeric(row?.[`KTKT:${cell}`]);
        if (value !== null) latestHours.set(cell, value);
      }
    };
    for (const item of earlierHours as { fieldCode: string; value: string }[]) rememberHours({ [item.fieldCode]: item.value });

    const applyBcsxLinks = (sheet: ExcelJS.Worksheet, date: string) => {
      const linked = deriveCtktktCellsFromBcsx(readingsByDate.get(date) || []);
      for (const [cell, value] of Object.entries(linked.entries)) setNumber(sheet, cell, numeric(value));
    };
    const applyWaterLinks = (sheet: ExcelJS.Worksheet, date: string) => {
      for (const [cell, value] of Object.entries(deriveCtktktCellsFromWater(waterLogs, date))) {
        const curVal = sheet.getCell(cell).value;
        if (curVal === null || curVal === undefined || curVal === 0 || curVal === "" || Number(value) > 0) {
          setNumber(sheet, cell, numeric(value));
        }
      }
    };

    const workbook = new ExcelJS.Workbook();
    const templateBytes = Uint8Array.from(atob(CTKTKT_TEMPLATE_BASE64), character => character.charCodeAt(0));
    await workbook.xlsx.load(templateBytes.buffer);
    sanitizeCtktktTemplate(workbook);
    const inputCells = [
      ...CTKTKT_DAY03_INPUT_CELLS,
      ...CTKTKT_EXTRA_INPUT_FIELDS.map(field => field.cell),
    ].filter(cell => !CTKTKT_NON_WORKBOOK_INPUT_CELLS.has(cell));
    const exportableCells = new Set<string>(inputCells);
    for (const sheetName of ["d-1", ...Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, "0"))]) {
      const sheet = workbook.getWorksheet(sheetName);
      if (!sheet) continue;
      for (const cell of inputCells) sheet.getCell(cell).value = null;
    }

    const previousSheet = workbook.getWorksheet("d-1");
    const previousRow = byDate.get(previous);
    if (previousSheet) {
      if (previousRow) fillDailyFallbacks(previousSheet, previousRow);
      // Seeds the W86 → W89 coal stock chain of the month with the QLKT stock when not entered.
      setNumber(previousSheet, "W86", numeric(previousRow?.AR));
      prepareCtktktPreviousMonthSheet(previousSheet, "01");
      for (const [code, value] of Object.entries(previousRow || {})) if (code.startsWith("KTKT:") && exportableCells.has(code.slice(5)) && !CTKTKT_BCSX_LINKED_CELLS.has(code.slice(5)) && !CTKTKT_WATER_LINKED_CELLS.has(code.slice(5))) {
        const cell = code.slice(5);
        previousSheet.getCell(cell).value = cell === "T181" ? value : numeric(value);
      }
      for (const cell of ["E39", "H39"]) if (numeric(previousRow?.[`KTKT:${cell}`]) === null) setNumber(previousSheet, cell, CTKTKT_GRINDING_BALL_DEFAULT);
      rememberHours(previousRow);
      applyCtktktCarriedValues(previousSheet, CTKTKT_OPERATING_HOURS_CELLS, latestHours);
      applyBcsxLinks(previousSheet, previous);
      applyWaterLinks(previousSheet, previous);
      applyWaterAdjustments(previousSheet, previousRow || {});
      applyCoalAdjustmentNotes(previousSheet, previousRow || {});
      applyCtktktCoalAdjustmentTotals(previousSheet);
      applyDateLabels(previousSheet, previous, false);
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${period}-${String(day).padStart(2, "0")}`;
      const sheet = workbook.getWorksheet(String(day).padStart(2, "0"));
      if (!sheet) continue;
      const previousSheetName = day === 1 ? "d-1" : String(day - 1).padStart(2, "0");
      normalizeCoalMeterFormulas(sheet, previousSheetName);
      prepareCtktktDaySheet(sheet, day < daysInMonth ? String(day + 1).padStart(2, "0") : null);
      const row = byDate.get(date) || {};
      fillDailyFallbacks(sheet, row);
      for (const [code, value] of Object.entries(row)) if (code.startsWith("KTKT:") && exportableCells.has(code.slice(5)) && !CTKTKT_BCSX_LINKED_CELLS.has(code.slice(5)) && !CTKTKT_WATER_LINKED_CELLS.has(code.slice(5))) {
        const cell = code.slice(5);
        sheet.getCell(ctktktExportCell(cell, true)).value = cell === "T181" ? value : numeric(value);
      }
      const previousDate = day === 1
        ? previous
        : `${period}-${String(day - 1).padStart(2, "0")}`;
      applyCtktktDailyCarryovers(sheet, row, byDate.get(previousDate), previousSheetName);
      applyCtktktCoalAdjustmentTotals(sheet);
      rememberHours(row);
      applyCtktktCarriedValues(sheet, CTKTKT_OPERATING_HOURS_CELLS, latestHours);
      applyNh3StartLevelCarryover(sheet, byDate.get(previousDate));
      applyCtktktStartupEventMetadata(sheet, row);
      applyBcsxLinks(sheet, date);
      applyWaterLinks(sheet, date);
      applyWaterAdjustments(sheet, row);
      applyCoalAdjustmentNotes(sheet, row);
      applyDateLabels(sheet, date, true);
    }
    const totalSheet = workbook.getWorksheet("Tổng hợp tháng");
    if (totalSheet) totalSheet.getCell("A1").value = `Tổng hợp tháng ${month}/${year}`;
    workbook.calcProperties.fullCalcOnLoad = true;
    const output = new Uint8Array(await workbook.xlsx.writeBuffer());
    return new Response(output, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="CHI_TIEU_KTKT_${period}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Không xuất được file Chỉ tiêu KTKT.", error);
    return Response.json({ error: "Không xuất được file Chỉ tiêu KTKT." }, { status: 500 });
  }
}
