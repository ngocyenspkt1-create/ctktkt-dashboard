import {
  calculateCtktktSummary,
  calculateDailyAverageMoisture,
  calculateDailyOilConsumption,
  calculateNh3DcsSummary,
  calculateNh3Summary,
  type CtktktDayEntries,
} from "./ctktkt-report.ts";

export const CTKTKT_LINKED_DAILY_CODES = new Set([
  "B", "C", "H", "I", "X", "AE", "AF", "AE_ADJ", "AF_ADJ", "AJ", "AT", "BN", "BQ", "BR", "CJ", "CN", "Q181",
]);

export const QLKT_DIRECT_DAILY_CODES = new Set([
  "F", "L", "AR", "CC", "CD", "CS", "CT", "CU", "CV",
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
  setNumber(result, "AE", summary.s1.rawCoalTonnes);
  setNumber(result, "AF", summary.s2.rawCoalTonnes);
  setNumber(result, "AE_ADJ", summary.s1.adjustedCoalTonnes);
  setNumber(result, "AF_ADJ", summary.s2.adjustedCoalTonnes);
  setNumber(result, "AJ", summary.plant.hhvKjKg);
  setNumber(result, "Q181", numberOf(current, "Q181"));
  setNumber(result, "AT", numberOf(current, "I36"));
  setNumber(result, "CJ", calculateDailyAverageMoisture(current, previous));

  const oilS1 = calculateDailyOilConsumption(current, "s1", previous);
  const oilS2 = calculateDailyOilConsumption(current, "s2", previous);
  setNumber(result, "X", oilS1 === null || oilS2 === null ? null : Math.max(0, oilS1 + oilS2));

  const nh3 = calculateNh3Summary(current, null, null);
  setNumber(result, "BN", nh3.usedTonnes);
  setNumber(result, "CN", numberOf(current, "P72"));

  const nh3Dcs = calculateNh3DcsSummary(current, previous);
  setNumber(result, "BQ", nh3Dcs.s1?.usedTonnes);
  setNumber(result, "BR", nh3Dcs.s2?.usedTonnes);

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
