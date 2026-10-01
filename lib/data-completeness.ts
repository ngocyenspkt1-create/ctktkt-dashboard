import { SHIFT_METRICS, SHIFT_TIME_SLOTS, type ShiftMetric, type Unit } from "./bcsx.ts";
import { SHIFT_TIMES } from "./water-report/schema.ts";

export type MissingDataItem = { key: string; label: string; group?: string };

export function isMissingValue(value: unknown) {
  return value === undefined || value === null || String(value).trim() === "";
}

export function elapsedDaysInPeriod(period: string, throughDate: string) {
  if (period < throughDate.slice(0, 7)) return new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0).getDate();
  if (period > throughDate.slice(0, 7)) return 0;
  return Number(throughDate.slice(8, 10));
}

export function listMonthlyMissing(
  rows: Array<Record<string, string>>,
  period: string,
  throughDate: string,
  requiredFields: Array<{ code: string; label: string }>,
): MissingDataItem[] {
  const throughDay = elapsedDaysInPeriod(period, throughDate);
  const items: MissingDataItem[] = [];
  for (let day = 1; day <= throughDay; day += 1) {
    for (const field of requiredFields) {
      if (isMissingValue(rows[day - 1]?.[field.code])) {
        items.push({ key: `${day}:${field.code}`, label: `Ngày ${String(day).padStart(2, "0")} · ${field.label} [${field.code}]`, group: `Ngày ${String(day).padStart(2, "0")}` });
      }
    }
  }
  return items;
}

export function listBcsxMissing(grids: Record<Unit, Record<ShiftMetric, string[]>>) {
  const items: MissingDataItem[] = [];
  for (const unit of ["S1", "S2"] as const) {
    for (const metric of SHIFT_METRICS) {
      SHIFT_TIME_SLOTS.forEach((slot, index) => {
        if (isMissingValue(grids[unit][metric.key]?.[index])) {
          items.push({ key: `${unit}:${metric.key}:${slot}`, label: `${slot} · ${metric.label}`, group: unit });
        }
      });
    }
  }
  return items;
}

export function listMissingWaterShifts(shifts: Array<{ logDate: string; shiftTime: string }>, month: string, throughDate: string) {
  const expected = new Set(shifts.map(shift => `${shift.logDate}|${shift.shiftTime}`));
  const items: MissingDataItem[] = [];
  const throughDay = elapsedDaysInPeriod(month, throughDate);
  for (let day = 1; day <= throughDay; day += 1) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    for (const shiftTime of SHIFT_TIMES) {
      if (!expected.has(`${date}|${shiftTime}`)) {
        items.push({ key: `${date}:${shiftTime}`, label: `${date.split("-").reverse().join("/")} · ca ${shiftTime}`, group: "Ca chưa nhập" });
      }
    }
  }
  return items;
}
