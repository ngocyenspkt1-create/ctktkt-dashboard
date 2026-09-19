import { getRawDb } from "@/db";
import { requirePermission } from "@/lib/auth/server";
import { CTKTKT_INPUT_FIELDS } from "@/lib/ctktkt-fields.generated";

const fieldCells = new Set<string>(CTKTKT_INPUT_FIELDS.map(field => field.cell));
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
    const { results } = await getRawDb().prepare(
      "SELECT operating_date AS operatingDate, substr(field_code, 6) AS cell, value FROM daily_inputs WHERE operating_date >= ? AND operating_date < ? AND field_code LIKE 'KTKT:%' ORDER BY operating_date, field_code",
    ).bind(from, next).all();
    return Response.json({ entries: results }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Chưa tải được dữ liệu Chỉ tiêu KTKT." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const guard = await requirePermission("edit_daily_inputs");
  if (!guard.ok) return guard.response;
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
      const value = String(entry.value ?? "").trim().replace(",", ".");
      if (!fieldCells.has(cell)) throw new Error(`Ô ${cell || "không rõ"} không nằm trong mẫu được phép nhập.`);
      if (value.length > 80) throw new Error(`Giá trị ô ${cell} quá dài.`);
      if (value && cell !== "T181" && !/^-?\d+(?:\.\d+)?$/.test(value)) throw new Error(`Ô ${cell} phải là số.`);
      return { cell, value };
    });
    const db = getRawDb();
    const statements = clean.map(entry => entry.value === ""
      ? db.prepare("DELETE FROM daily_inputs WHERE operating_date = ? AND field_code = ?").bind(body.operatingDate, `KTKT:${entry.cell}`)
      : db.prepare("INSERT INTO daily_inputs (operating_date, field_code, value, note, updated_at) VALUES (?, ?, ?, '', CURRENT_TIMESTAMP) ON CONFLICT(operating_date, field_code) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP").bind(body.operatingDate, `KTKT:${entry.cell}`, entry.value));
    if (statements.length) await db.batch(statements);
    return Response.json({ saved: clean.filter(entry => entry.value !== "").length });
  } catch (error) {
    return Response.json({ error: error instanceof SyntaxError ? "Dữ liệu JSON không hợp lệ." : error instanceof Error ? error.message : "Dữ liệu không hợp lệ." }, { status: 400 });
  }
}
