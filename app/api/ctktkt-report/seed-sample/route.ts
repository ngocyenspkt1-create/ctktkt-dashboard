import { getRawDb } from "@/db";
import { CTKTKT_SAMPLE_2DAYS, seedCtktktSample2Days } from "@/lib/ctktkt-sample-data";

export async function POST() {
  try {
    const db = getRawDb();
    const { totalManual, totalShift } = await seedCtktktSample2Days(db);

    return Response.json({
      ok: true,
      message: `Đã nạp thành công dữ liệu ngày 16/09 và 17/09/2026 (${totalManual} ô số liệu và ${totalShift} điểm đo BCSX).`,
      dates: Object.keys(CTKTKT_SAMPLE_2DAYS),
      totalManual,
      totalShift,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Không nạp được số liệu mẫu." },
      { status: 500 },
    );
  }
}

export async function GET() {
  return POST();
}
