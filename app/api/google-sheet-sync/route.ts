import { getRawDb } from "@/db";
import {
  buildGoogleSheetDayPayload,
  type DailyInputEntry,
  type StoredPpaEntry,
} from "@/lib/google-sheet-sync";

const datePattern = /^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "Yêu cầu phải là JSON." }, { status: 415 });

  try {
    const raw = await request.text();
    if (raw.length > 10_000) return Response.json({ error: "Yêu cầu quá lớn." }, { status: 413 });
    const body = JSON.parse(raw) as Record<string, unknown>;
    const operatingDate = String(body.operatingDate || "");
    if (!datePattern.test(operatingDate)) throw new Error("Ngày đồng bộ không hợp lệ.");

    const db = getRawDb();
    const [dailyResult, ppaResult] = await Promise.all([
      db.prepare("SELECT field_code AS fieldCode, value FROM daily_inputs WHERE operating_date = ? ORDER BY field_code").bind(operatingDate).all(),
      db.prepare("SELECT ppa_plant AS ppaPlant, ppa_s1 AS ppaS1, ppa_s2 AS ppaS2, note_s1 AS noteS1, note_s2 AS noteS2 FROM ppa_heat_rate_daily WHERE operating_date = ? LIMIT 1").bind(operatingDate).first(),
    ]);
    const preview = buildGoogleSheetDayPayload(
      operatingDate,
      dailyResult.results as unknown as DailyInputEntry[],
      (ppaResult || null) as StoredPpaEntry | null,
    );
    return Response.json({ preview }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof SyntaxError
        ? "Dữ liệu JSON không hợp lệ."
        : error instanceof Error ? error.message : "Không đồng bộ được Google Sheet.";
    return Response.json({ error: message }, { status: 400 });
  }
}
