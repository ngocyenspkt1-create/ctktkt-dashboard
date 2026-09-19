import ExcelJS from "exceljs";
import { getRawDb } from "@/db";
import { calculateDailyProduction } from "@/lib/daily-production-calculations";
import { CTKTKT_BCSX_LINKED_CELLS, deriveCtktktCellsFromBcsx, type CtktktBcsxReading } from "@/lib/ctktkt-bcsx-link";
import { CTKTKT_INPUT_FIELDS } from "@/lib/ctktkt-fields.generated";
import { CTKTKT_TEMPLATE_BASE64 } from "@/lib/ctktkt-template.generated";

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

function fillDailyFallbacks(sheet: ExcelJS.Worksheet, row: Record<string, string>) {
  const value = (code: string) => numeric(row[code]);
  const B = value("B"), C = value("C"), H = value("H"), I = value("I");
  const AE = value("AE"), AF = value("AF"), AJ = value("AJ"), CJ = value("CJ"), AR = value("AR");
  setNumber(sheet, "J157", B === null ? null : B * 1000);
  setNumber(sheet, "K157", C === null ? null : C * 1000);
  setNumber(sheet, "J158", H === null ? null : H * 1000);
  setNumber(sheet, "K158", I === null ? null : I * 1000);
  setNumber(sheet, "W86", AR);
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

function applyDateLabels(sheet: ExcelJS.Worksheet, date: string) {
  const display = date.split("-").reverse().join("/");
  sheet.getCell("Z57").value = display;
  sheet.getCell("AJ57").value = display;
  sheet.getCell("AE83").value = `Ngày ${display.slice(0, 5)}`;
  sheet.getCell("N68").value = `Mức bồn 00h00 ${display}`;
  sheet.getCell("O68").value = `Mức bồn 24h00 ${display}`;
}

export async function GET(request: Request) {
  const period = new URL(request.url).searchParams.get("period") || "";
  if (!periodPattern.test(period)) return Response.json({ error: "Tháng không hợp lệ." }, { status: 400 });
  try {
    const { year, month, previous, next } = monthBounds(period);
    const db = getRawDb();
    const { results } = await db.prepare(
      "SELECT operating_date AS operatingDate, field_code AS fieldCode, value FROM daily_inputs WHERE operating_date >= ? AND operating_date < ? ORDER BY operating_date, field_code",
    ).bind(previous, next).all();
    const { results: shiftResults } = await db.prepare(
      "SELECT operating_date AS operatingDate, unit, time_slot AS timeSlot, metric, value FROM shift_readings WHERE operating_date >= ? AND operating_date < ? ORDER BY operating_date, unit, time_slot, metric",
    ).bind(previous, next).all();
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

    const applyBcsxLinks = (sheet: ExcelJS.Worksheet, date: string) => {
      const linked = deriveCtktktCellsFromBcsx(readingsByDate.get(date) || []);
      if (linked.warnings.length) throw new Error(`BCSX ngày ${date}: ${linked.warnings.map(item => item.message).join(" ")}`);
      for (const [cell, value] of Object.entries(linked.entries)) setNumber(sheet, cell, numeric(value));
    };

    const workbook = new ExcelJS.Workbook();
    const templateBytes = Uint8Array.from(atob(CTKTKT_TEMPLATE_BASE64), character => character.charCodeAt(0));
    await workbook.xlsx.load(templateBytes.buffer);
    const inputCells = CTKTKT_INPUT_FIELDS.map(field => field.cell);
    for (const sheetName of ["d-1", ...Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, "0"))]) {
      const sheet = workbook.getWorksheet(sheetName);
      if (!sheet) continue;
      for (const cell of inputCells) sheet.getCell(cell).value = null;
    }

    const previousSheet = workbook.getWorksheet("d-1");
    const previousRow = byDate.get(previous);
    if (previousSheet) {
      if (previousRow) fillDailyFallbacks(previousSheet, previousRow);
      for (const [code, value] of Object.entries(previousRow || {})) if (code.startsWith("KTKT:") && !CTKTKT_BCSX_LINKED_CELLS.has(code.slice(5))) {
        const cell = code.slice(5);
        previousSheet.getCell(cell).value = cell === "T181" ? value : numeric(value);
      }
      applyBcsxLinks(previousSheet, previous);
      applyDateLabels(previousSheet, previous);
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${period}-${String(day).padStart(2, "0")}`;
      const sheet = workbook.getWorksheet(String(day).padStart(2, "0"));
      if (!sheet) continue;
      const row = byDate.get(date) || {};
      fillDailyFallbacks(sheet, row);
      for (const [code, value] of Object.entries(row)) if (code.startsWith("KTKT:") && !CTKTKT_BCSX_LINKED_CELLS.has(code.slice(5))) {
        const cell = code.slice(5);
        sheet.getCell(cell).value = cell === "T181" ? value : numeric(value);
      }
      applyBcsxLinks(sheet, date);
      applyDateLabels(sheet, date);
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
    return Response.json({ error: error instanceof Error ? error.message : "Không xuất được file Chỉ tiêu KTKT." }, { status: 500 });
  }
}
