import { getRawDb } from "@/db";
import { CTKTKT_SAMPLE_2DAYS } from "@/lib/ctktkt-sample-data";
import { CTKTKT_BCSX_LINKED_CELLS } from "@/lib/ctktkt-bcsx-link";
import { CTKTKT_WATER_LINKED_CELLS } from "@/lib/ctktkt-water-link";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function seedCtktktSample2Days(db: any) {
  let totalManual = 0;
  let totalShift = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statements: any[] = [];

  for (const [date, data] of Object.entries(CTKTKT_SAMPLE_2DAYS)) {
    for (const reading of data.shiftReadings) {
      totalShift++;
      statements.push(
        db.prepare(
          "INSERT INTO shift_readings (operating_date, unit, time_slot, metric, value, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(operating_date, unit, time_slot, metric) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
        ).bind(date, reading.unit, reading.timeSlot, reading.metric, reading.value),
      );
    }

    for (const entry of data.manualEntries) {
      if (CTKTKT_BCSX_LINKED_CELLS.has(entry.cell) || CTKTKT_WATER_LINKED_CELLS.has(entry.cell)) continue;
      totalManual++;
      statements.push(
        db.prepare(
          "INSERT INTO daily_inputs (operating_date, field_code, value, note, updated_at) VALUES (?, ?, ?, '', CURRENT_TIMESTAMP) ON CONFLICT(operating_date, field_code) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
        ).bind(date, `KTKT:${entry.cell}`, entry.value),
      );
    }
  }

  const batchSize = 100;
  for (let i = 0; i < statements.length; i += batchSize) {
    await db.batch(statements.slice(i, i + batchSize));
  }

  return { totalManual, totalShift };
}

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
