import type { getRawDb } from "@/db";
import {
  calculateOperatingHours,
  CTKTKT_OPERATING_HOURS_SOURCE_CODES,
  CTKTKT_OPERATING_HOURS_START_DATE,
  formatOperatingHours,
  type OperatingHoursTotals,
} from "./ctktkt-operating-hours";

type RawDb = ReturnType<typeof getRawDb>;

/**
 * Lũy kế giờ theo QLKT cho các ngày trong [from, next).
 * Trả về các ô W68:Z69 dạng liên kết và danh sách ngày QLKT còn thiếu giờ phát tới hết khoảng.
 */
export async function loadCtktktOperatingHours(db: RawDb, from: string, next: string) {
  const codes = [...CTKTKT_OPERATING_HOURS_SOURCE_CODES];
  const { results } = await db.prepare(
    `SELECT operating_date AS operatingDate, field_code AS fieldCode, value FROM daily_inputs WHERE operating_date >= ? AND operating_date < ? AND field_code IN (${codes.map(() => "?").join(", ")})`,
  ).bind(CTKTKT_OPERATING_HOURS_START_DATE, next, ...codes).all();
  const daily = new Map<string, Record<string, string>>();
  for (const row of results as Array<{ operatingDate: string; fieldCode: string; value: string }>) {
    const day = daily.get(row.operatingDate) || {};
    day[row.fieldCode] = String(row.value ?? "");
    daily.set(row.operatingDate, day);
  }
  const lastDate = new Date(`${next}T12:00:00Z`);
  lastDate.setUTCDate(lastDate.getUTCDate() - 1);
  const through = lastDate.toISOString().slice(0, 10);
  const result = calculateOperatingHours(daily, through);
  const entries: Array<{ operatingDate: string; cell: string; value: string }> = [];
  const totalsByDate = new Map<string, OperatingHoursTotals>();
  for (const [operatingDate, totals] of result.byDate) {
    if (operatingDate < from) continue;
    totalsByDate.set(operatingDate, totals);
    for (const [cell, value] of Object.entries(totals)) entries.push({ operatingDate, cell, value: formatOperatingHours(value) });
  }
  return { entries, totalsByDate, missingDates: result.missingDates };
}
