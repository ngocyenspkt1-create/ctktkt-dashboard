import {
  calculateCtktktSummary,
  calculateDailyOilConsumption,
  calculateNh3DcsSummary,
  type CtktktDayEntries,
} from "./ctktkt-report.ts";

export const CTKTKT_LINKED_DAILY_CODES = new Set([
  "B", "C", "H", "I", "X", "AE", "AF", "AJ", "AT", "BQ", "BR",
]);

export const QLKT_DIRECT_DAILY_CODES = new Set([
  "F", "L", "AR", "CC", "CD", "CS", "CT", "CU", "CV",
]);

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
  setNumber(result, "AJ", summary.plant.hhvKjKg);
  setNumber(result, "AT", numberOf(current, "I36"));

  const oilS1 = calculateDailyOilConsumption(current, "s1", previous);
  const oilS2 = calculateDailyOilConsumption(current, "s2", previous);
  setNumber(result, "X", oilS1 === null || oilS2 === null ? null : Math.max(0, oilS1 + oilS2));

  const nh3Dcs = calculateNh3DcsSummary(current);
  setNumber(result, "BQ", nh3Dcs.s1?.usedTonnes);
  setNumber(result, "BR", nh3Dcs.s2?.usedTonnes);

  return result;
}
