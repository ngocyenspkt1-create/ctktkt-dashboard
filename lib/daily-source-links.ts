import {
  calculateCtktktSummary,
  calculateDailyAverageMoisture,
  calculateOilEventSummary,
  calculateNh3DcsSummary,
  calculateNh3Summary,
  type CtktktDayEntries,
} from "./ctktkt-report.ts";
import { isCtktktOilEventCode } from "./ctktkt-oil-event.ts";

export const CTKTKT_LINKED_DAILY_CODES = new Set([
  "B", "C", "H", "I", "X", "AE", "AF", "AE_ADJ", "AF_ADJ", "AJ", "AT", "BN", "BQ", "BR", "CJ", "CN", "CC", "CD", "CE", "CF", "Q181",
]);

export const QLKT_DIRECT_DAILY_CODES = new Set([
  "F", "L", "AR", "CS", "CT", "CU", "CV", "GRID_RECEIVE_S1", "GRID_RECEIVE_S2",
]);

type DailyInputEntry = { operatingDate: string; fieldCode: string; value: string };
type CtktktInputEntry = { operatingDate: string; cell: string; value: string };

function numberOf(entries: CtktktDayEntries, cell: string) {
  const raw = entries[cell];
  if (!raw?.trim()) return null;
  const value = Number(raw.trim().replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function setNumber(result: Record<string, string>, code: string, value: number | null | undefined) {
  if (value !== null && value !== undefined && Number.isFinite(value)) {
    result[code] = String(Number(value.toPrecision(15)));
  }
}

function deminWaterUsage(
  current: CtktktDayEntries,
  previous: CtktktDayEntries | undefined,
  row: "72" | "73",
) {
  const end = numberOf(current, `X${row}`);
  const start = numberOf(current, `W${row}`) ?? numberOf(previous || {}, `X${row}`);
  const adjustment = numberOf(current, row === "72" ? "WATER_ADJ_S1" : "WATER_ADJ_S2") ?? 0;
  return end === null || start === null ? null : end - start + adjustment;
}

export function deriveDailyValuesFromCtktkt(
  current: CtktktDayEntries,
  previous?: CtktktDayEntries,
) {
  const result: Record<string, string> = {};
  const summary = calculateCtktktSummary(current, previous);

  const grossS1 = numberOf(current, "J157");
  const netS1 = numberOf(current, "K157");
  const grossS2 = numberOf(current, "J158");
  const netS2 = numberOf(current, "K158");
  setNumber(result, "B", grossS1 === null ? null : grossS1 / 1000);
  setNumber(result, "C", netS1 === null ? null : netS1 / 1000);
  setNumber(result, "H", grossS2 === null ? null : grossS2 / 1000);
  setNumber(result, "I", netS2 === null ? null : netS2 / 1000);
  // Bảng tháng dùng số than quy ẩm 8,5% tại cột PMIS/QLKT của Cụm 1.
  // Giữ đồng thời AE_ADJ/AF_ADJ để các công thức phía sau không quy ẩm lần hai.
  setNumber(result, "AE", summary.s1.adjustedCoalTonnes);
  setNumber(result, "AF", summary.s2.adjustedCoalTonnes);
  setNumber(result, "AE_ADJ", summary.s1.adjustedCoalTonnes);
  setNumber(result, "AF_ADJ", summary.s2.adjustedCoalTonnes);
  setNumber(result, "AJ", summary.plant.hhvKjKg);
  setNumber(result, "Q181", numberOf(current, "Q181"));
  setNumber(result, "AT", numberOf(current, "W87"));
  setNumber(result, "CJ", calculateDailyAverageMoisture(current, previous));

  const oilEventCode = current.STARTUP_EVENT || "";
  const oilEvent = isCtktktOilEventCode(oilEventCode)
    ? calculateOilEventSummary(current, oilEventCode)
    : null;
  setNumber(result, "X", oilEvent?.totalTonnes);

  const nh3 = calculateNh3Summary(current, null, null);
  setNumber(result, "BN", nh3.usedTonnes);
  setNumber(result, "CN", numberOf(current, "P72"));

  const nh3Dcs = calculateNh3DcsSummary(current, previous);
  setNumber(result, "BQ", nh3Dcs.s1?.usedTonnes);
  setNumber(result, "BR", nh3Dcs.s2?.usedTonnes);

  setNumber(result, "CC", deminWaterUsage(current, previous, "72"));
  setNumber(result, "CD", deminWaterUsage(current, previous, "73"));
  setNumber(result, "CE", numberOf(current, "Z72"));
  setNumber(result, "CF", numberOf(current, "Z73"));

  return result;
}

export function mergeDailyInputsWithCtktkt(
  dailyEntries: DailyInputEntry[],
  ctktktEntries: CtktktInputEntry[],
  period: string,
) {
  const ctktktByDate = new Map<string, CtktktDayEntries>();
  for (const entry of ctktktEntries) {
    const values = ctktktByDate.get(entry.operatingDate) || {};
    values[entry.cell] = entry.value;
    ctktktByDate.set(entry.operatingDate, values);
  }

  const merged = new Map<string, DailyInputEntry>();
  for (const entry of dailyEntries) {
    if (!CTKTKT_LINKED_DAILY_CODES.has(entry.fieldCode)) {
      merged.set(`${entry.operatingDate}|${entry.fieldCode}`, entry);
    }
  }

  for (const [operatingDate, current] of ctktktByDate) {
    if (!operatingDate.startsWith(`${period}-`)) continue;
    const previousDate = new Date(`${operatingDate}T12:00:00+07:00`);
    previousDate.setDate(previousDate.getDate() - 1);
    const previousIso = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(previousDate);
    const linked = deriveDailyValuesFromCtktkt(current, ctktktByDate.get(previousIso));
    for (const [fieldCode, value] of Object.entries(linked)) {
      merged.set(`${operatingDate}|${fieldCode}`, { operatingDate, fieldCode, value });
    }
  }

  return [...merged.values()].sort((left, right) =>
    left.operatingDate.localeCompare(right.operatingDate)
      || left.fieldCode.localeCompare(right.fieldCode),
  );
}
