import { getRawDb } from "@/db";
import { requireEditor } from "@/lib/auth/server";

const datePattern = /^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;

export async function POST(request: Request) {
  const guard = await requireEditor(); if (!guard.ok) return guard.response;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "Yêu cầu phải là JSON." }, { status: 415 });
  try {
    const raw = await request.text();
    if (raw.length > 600_000) return Response.json({ error: "Dữ liệu gửi lên quá lớn." }, { status: 413 });
    const body = JSON.parse(raw) as { entries?: unknown };
    if (!Array.isArray(body.entries) || body.entries.length > 500) throw new Error("Danh sách đánh giá lịch sử không hợp lệ.");
    const seen = new Set<string>();
    const entries = body.entries.map(item => {
      if (!item || typeof item !== "object") throw new Error("Một dòng đánh giá không hợp lệ.");
      const value = item as Record<string, unknown>;
      const operatingDate = String(value.operatingDate || "");
      const noteS1 = String(value.noteS1 || "").trim(), noteS2 = String(value.noteS2 || "").trim();
      if (!datePattern.test(operatingDate) || seen.has(operatingDate)) throw new Error("Ngày đánh giá không hợp lệ hoặc bị trùng.");
      if (noteS1.length > 1000 || noteS2.length > 1000) throw new Error(`Đánh giá ngày ${operatingDate} dài quá 1.000 ký tự.`);
      seen.add(operatingDate);
      return { operatingDate, noteS1, noteS2 };
    });
    const db = getRawDb();
    const statements = entries.map(entry => entry.noteS1 && entry.noteS2
      ? db.prepare("UPDATE ppa_heat_rate_daily SET note_s1 = ?, note_s2 = ?, updated_at = CURRENT_TIMESTAMP WHERE operating_date = ?").bind(entry.noteS1, entry.noteS2, entry.operatingDate)
      : entry.noteS1
        ? db.prepare("UPDATE ppa_heat_rate_daily SET note_s1 = ?, updated_at = CURRENT_TIMESTAMP WHERE operating_date = ?").bind(entry.noteS1, entry.operatingDate)
        : db.prepare("UPDATE ppa_heat_rate_daily SET note_s2 = ?, updated_at = CURRENT_TIMESTAMP WHERE operating_date = ?").bind(entry.noteS2, entry.operatingDate));
    const results = statements.length ? await db.batch(statements) : [];
    const updated = results.reduce((sum, result) => sum + Number(result.meta.changes || 0), 0);
    return Response.json({ received: entries.length, updated, skipped: entries.length - updated });
  } catch (error) {
    return Response.json({ error: error instanceof SyntaxError ? "Dữ liệu JSON không hợp lệ." : error instanceof Error ? error.message : "Dữ liệu không hợp lệ." }, { status: 400 });
  }
}
