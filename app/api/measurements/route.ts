import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { measurements } from "../../../db/schema";

function unavailable(error: unknown) { const message = error instanceof Error ? error.message : "Không thể truy cập kho dữ liệu."; return Response.json({ error: message }, { status: 500 }); }
export async function GET() { try { const rows = await getDb().select().from(measurements).orderBy(desc(measurements.id)).limit(100); return Response.json({ measurements: rows }); } catch (error) { return unavailable(error); } }
export async function POST(request: Request) {
  try {
    const input = (await request.json()) as Record<string, unknown>;
    const metricCode = String(input.metricCode ?? "").trim(); const metricName = String(input.metricName ?? "").trim(); const period = String(input.period ?? "").trim(); const actual = Number(input.actual); const limitValue = Number(input.limitValue); const note = String(input.note ?? "").trim();
    if (!metricCode || !metricName || !/^\d{4}-\d{2}$/.test(period) || !Number.isFinite(actual) || actual < 0 || !Number.isFinite(limitValue)) return Response.json({ error: "Dữ liệu chỉ tiêu chưa hợp lệ." }, { status: 400 });
    const [saved] = await getDb().insert(measurements).values({ metricCode, metricName, period, actual: String(actual), limitValue: String(limitValue), note }).returning();
    return Response.json({ measurement: saved }, { status: 201 });
  } catch (error) { return unavailable(error); }
}
