import { getRawDb } from "@/db";
import { getSessionUser } from "@/lib/auth/server";
import { canEditAnyCtktktField, canEditCtktktField } from "@/lib/ctktkt-permissions";
import { CTKTKT_BCSX_LINKED_CELLS, deriveCtktktCellsFromBcsx, type CtktktBcsxReading } from "@/lib/ctktkt-bcsx-link";
import { CTKTKT_WATER_LINKED_CELLS, ctktktWaterLogFromRow, deriveCtktktCellsFromWater } from "@/lib/ctktkt-water-link";
import { CTKTKT_INPUT_FIELDS } from "@/lib/ctktkt-fields.generated";
import { CTKTKT_EXTRA_INPUT_FIELDS, CTKTKT_TEXT_INPUT_CELLS, normalizeCtktktInputValue } from "@/lib/ctktkt-extra-fields";
import { ensureWaterSchema } from "@/lib/water-report/schema";
import { seedCtktktSample2Days } from "./seed-sample/route";

const fieldCells = new Set<string>([
  ...CTKTKT_INPUT_FIELDS.map(field => field.cell),
  ...CTKTKT_EXTRA_INPUT_FIELDS.map(field => field.cell),
].filter(cell => !CTKTKT_BCSX_LINKED_CELLS.has(cell) && !CTKTKT_WATER_LINKED_CELLS.has(cell)));
const periodPattern = /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/;
const datePattern = /^(19|20|21)\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;

function monthBounds(period: string) {
  const [year, month] = period.split("-").map(Number);
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const previous = new Date(`${period}-01T12:00:00+07:00`);
  previous.setDate(previous.getDate() - 1);
  const from = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(previous);
  return { from, next };
}

export async function GET(request: Request) {
  const period = new URL(request.url).searchParams.get("period") || "";
  if (!periodPattern.test(period)) return Response.json({ error: "Tháng không hợp lệ." }, { status: 400 });
  const { from, next } = monthBounds(period);
  try {
    const db = getRawDb();
    await ensureWaterSchema(db);
    let { results } = await db.prepare(
      "SELECT operating_date AS operatingDate, substr(field_code, 6) AS cell, value FROM daily_inputs WHERE operating_date >= ? AND operating_date < ? AND field_code LIKE 'KTKT:%' ORDER BY operating_date, field_code",
    ).bind(from, next).all();
    let { results: shiftResults } = await db.prepare(
      "SELECT operating_date AS operatingDate, unit, time_slot AS timeSlot, metric, value FROM shift_readings WHERE operating_date >= ? AND operating_date < ? ORDER BY operating_date, unit, time_slot, metric",
    ).bind(from, next).all();
    const { results: waterResults } = await db.prepare(
      "SELECT log_date AS logDate, shift_time AS shiftTime, water_rec_s1 AS waterRecS1, water_rec_s2 AS waterRecS2, resin_water_s1_24h AS resinWaterS1_24h, resin_water_s2_24h AS resinWaterS2_24h FROM water_shift_logs WHERE log_date >= ? AND log_date < ? ORDER BY log_date, CASE shift_time WHEN '06h00' THEN 1 WHEN '14h00' THEN 2 WHEN '22h00' THEN 3 ELSE 9 END",
    ).bind(from, next).all();

    if (period === "2026-09" && (results as unknown[]).length === 0 && (shiftResults as unknown[]).length === 0) {
      await seedCtktktSample2Days(db);
      const reQuery = await db.prepare(
        "SELECT operating_date AS operatingDate, substr(field_code, 6) AS cell, value FROM daily_inputs WHERE operating_date >= ? AND operating_date < ? AND field_code LIKE 'KTKT:%' ORDER BY operating_date, field_code",
      ).bind(from, next).all();
      const reShift = await db.prepare(
        "SELECT operating_date AS operatingDate, unit, time_slot AS timeSlot, metric, value FROM shift_readings WHERE operating_date >= ? AND operating_date < ? ORDER BY operating_date, unit, time_slot, metric",
      ).bind(from, next).all();
      results = reQuery.results;
      shiftResults = reShift.results;
    }
    const readingsByDate = new Map<string, CtktktBcsxReading[]>();
    for (const reading of shiftResults as CtktktBcsxReading[]) {
      const date = reading.operatingDate || "";
      const list = readingsByDate.get(date) || [];
      list.push(reading);
      readingsByDate.set(date, list);
    }
    const linkedEntries: Array<{ operatingDate: string; cell: string; value: string }> = [];
    const warnings: Array<{ operatingDate: string; cell: string; message: string }> = [];
    for (const [operatingDate, readings] of readingsByDate) {
      const derived = deriveCtktktCellsFromBcsx(readings);
      for (const [cell, value] of Object.entries(derived.entries)) linkedEntries.push({ operatingDate, cell, value });
      for (const warning of derived.warnings) warnings.push({ operatingDate, ...warning });
    }
    const manualEntries = (results as Array<{ operatingDate: string; cell: string; value: string }>).filter(entry => !CTKTKT_BCSX_LINKED_CELLS.has(entry.cell));
    const manualKeys = new Set(manualEntries.map(e => `${e.operatingDate}|${e.cell}`));
    const waterLogs = (waterResults as Record<string, unknown>[]).map(ctktktWaterLogFromRow);
    for (const operatingDate of new Set(waterLogs.map(log => log.logDate))) {
      for (const [cell, value] of Object.entries(deriveCtktktCellsFromWater(waterLogs, operatingDate))) {
        if (!manualKeys.has(`${operatingDate}|${cell}`)) {
          linkedEntries.push({ operatingDate, cell, value });
        }
      }
    }
    return Response.json({ entries: manualEntries, linkedEntries, warnings }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Chưa tải được dữ liệu Chỉ tiêu KTKT." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  if (!canEditAnyCtktktField(user)) {
    return Response.json({ error: "Tài khoản của bạn không có quyền nhập liệu Chỉ tiêu KTKT." }, { status: 403 });
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "Yêu cầu phải là JSON." }, { status: 415 });
  try {
    const raw = await request.text();
    if (raw.length > 150_000) return Response.json({ error: "Dữ liệu gửi lên quá lớn." }, { status: 413 });
    const body = JSON.parse(raw) as { operatingDate?: unknown; entries?: unknown };
    if (typeof body.operatingDate !== "string" || !datePattern.test(body.operatingDate) || !Array.isArray(body.entries) || body.entries.length > 400) {
      throw new Error("Ngày hoặc danh sách ô nhập không hợp lệ.");
    }
    const clean = body.entries.map(item => {
      if (!item || typeof item !== "object") throw new Error("Một ô dữ liệu không hợp lệ.");
      const entry = item as Record<string, unknown>;
      const cell = String(entry.cell || "").toUpperCase();
      const isText = CTKTKT_TEXT_INPUT_CELLS.has(cell) || cell === "T181";
      const value = normalizeCtktktInputValue(cell, entry.value);
      if (!fieldCells.has(cell)) throw new Error(`Ô ${cell || "không rõ"} không nằm trong mẫu được phép nhập.`);
      if (value.length > (CTKTKT_TEXT_INPUT_CELLS.has(cell) ? 500 : 80)) throw new Error(`Giá trị ô ${cell} quá dài.`);
      if (value && !isText && !/^-?\d+(?:\.\d+)?$/.test(value)) throw new Error(`Ô ${cell} phải là số.`);
      return { cell, value };
    });

    // Chỉ lưu những ô mà người dùng có thẩm quyền theo cương vị / vai trò
    const authorizedEntries = clean.filter(entry => canEditCtktktField(user, entry.cell));
    if (authorizedEntries.length === 0 && clean.length > 0) {
      return Response.json({ error: "Bạn không có quyền sửa các ô dữ liệu đã gửi." }, { status: 403 });
    }

    const db = getRawDb();
    const statements = authorizedEntries.map(entry => entry.value === ""
      ? db.prepare("DELETE FROM daily_inputs WHERE operating_date = ? AND field_code = ?").bind(body.operatingDate, `KTKT:${entry.cell}`)
      : db.prepare("INSERT INTO daily_inputs (operating_date, field_code, value, note, updated_at) VALUES (?, ?, ?, '', CURRENT_TIMESTAMP) ON CONFLICT(operating_date, field_code) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP").bind(body.operatingDate, `KTKT:${entry.cell}`, entry.value));
    for (const cell of CTKTKT_BCSX_LINKED_CELLS) statements.push(db.prepare("DELETE FROM daily_inputs WHERE operating_date = ? AND field_code = ?").bind(body.operatingDate, `KTKT:${cell}`));
    for (const cell of CTKTKT_WATER_LINKED_CELLS) statements.push(db.prepare("DELETE FROM daily_inputs WHERE operating_date = ? AND field_code = ?").bind(body.operatingDate, `KTKT:${cell}`));
    if (statements.length) await db.batch(statements);
    return Response.json({ saved: authorizedEntries.filter(entry => entry.value !== "").length });
  } catch (error) {
    return Response.json({ error: error instanceof SyntaxError ? "Dữ liệu JSON không hợp lệ." : error instanceof Error ? error.message : "Dữ liệu không hợp lệ." }, { status: 400 });
  }
}
