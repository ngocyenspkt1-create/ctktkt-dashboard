import { CTKTKT_OIL_EVENT_CONFIG, type CtktktOilEventCode } from "./ctktkt-oil-event.ts";

export type CtktktDayEntries = Record<string, string>;

export type CtktktKpis = {
  grossMwh: number | null;
  netMwh: number | null;
  auxiliaryMwh: number | null;
  auxiliaryPercent: number | null;
  rawCoalTonnes: number | null;
  adjustedCoalTonnes: number | null;
  netCoalRate: number | null;
  netHeatRate: number | null;
  hhvKjKg?: number | null;
};

export type CtktktSummary = { s1: CtktktKpis; s2: CtktktKpis; plant: CtktktKpis };

export type Nh3Summary = {
  tankMassTotal: number | null;
  tankAvailable: Array<number | null>;
  tankAvailableTotal: number | null;
  stock24h: number | null;
  usedTonnes: number | null;
  rateGross: number | null;
  rateNet: number | null;
};

export const NH3_TANK_ROWS = [69, 70, 71] as const;
export const NH3_START_LEVEL_CELLS = new Set(NH3_TANK_ROWS.map(row => `N${row}`));

export function deriveNh3StartLevels(previous?: CtktktDayEntries): CtktktDayEntries {
  const derived: CtktktDayEntries = {};
  for (const row of NH3_TANK_ROWS) {
    const previousEndLevel = previous?.[`O${row}`]?.trim();
    if (previousEndLevel) derived[`N${row}`] = previousEndLevel;
  }
  return derived;
}

export function applyNh3StartLevelCarryover(
  entries: CtktktDayEntries,
  previous?: CtktktDayEntries,
): CtktktDayEntries {
  return { ...entries, ...deriveNh3StartLevels(previous) };
}

export type CoalShiftDetail = {
  unit: "S1" | "S2";
  shift: 1 | 2 | 3;
  rawCoalTonnes: number | null;
  moisturePercent: number | null;
  dryKcalKg: number | null;
  adjustedCoalTonnes: number | null;
  asReceivedKcalKg: number | null;
};

function numberOf(entries: CtktktDayEntries | undefined, cell: string) {
  const raw = entries?.[cell]?.trim().replace(",", ".");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function difference(current: number | null, previous: number | null) {
  return current === null || previous === null ? null : current - previous;
}

function sum(values: Array<number | null>) {
  return values.some(value => value === null) ? null : values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function divide(numerator: number | null, denominator: number | null, multiplier = 1) {
  return numerator === null || denominator === null || denominator === 0 ? null : numerator / denominator * multiplier;
}

function meterSum(entries: CtktktDayEntries | undefined, column: string) {
  return sum(Array.from({ length: 12 }, (_, index) => numberOf(entries, `${column}${16 + index}`)));
}

type CoalUnitResult = {
  rawCoalTonnes: number | null;
  adjustedCoalTonnes: number | null;
};

type CoalModelResult = {
  s1: CoalUnitResult;
  s2: CoalUnitResult;
  hhvKjKg: number | null;
};

function coalRawShifts(
  unit: "s1" | "s2",
  current: CtktktDayEntries,
  previous: CtktktDayEntries | undefined,
) {
  const isS1 = unit === "s1";
  const endColumn = isS1 ? "AB" : "AL";
  const firstColumn = isS1 ? "X" : "AH";
  const secondColumn = isS1 ? "Z" : "AJ";
  const previousCoal = meterSum(previous, endColumn);
  const adjustmentColumns = isS1 ? ["W", "Y", "AA"] : ["AG", "AI", "AK"];
  const base = [
    difference(meterSum(current, firstColumn), previousCoal),
    difference(meterSum(current, secondColumn), meterSum(current, firstColumn)),
    difference(meterSum(current, endColumn), meterSum(current, secondColumn)),
  ];
  return base.map((value, index) => value === null
    ? null
    : value + (numberOf(current, `${adjustmentColumns[index]}28`) ?? 0));
}

/**
 * Converts domestic 6A10 coal to the 8.5% moisture basis. The plant stopped
 * using Sub-bituminous coal, so legacy AL/AO values must not affect results.
 */
export function calculateCoalShiftDetails(
  current: CtktktDayEntries,
  previous: CtktktDayEntries | undefined,
): CoalShiftDetail[] {
  const s1Raw = coalRawShifts("s1", current, previous);
  const s2Raw = coalRawShifts("s2", current, previous);
  const rows = [87, 88, 89, 90, 91, 92];
  const rawShifts = [...s1Raw, ...s2Raw];

  return rawShifts.map((raw, index) => {
    const row = rows[index];
    const moisture = numberOf(current, `AJ${row}`);
    const dryKcalKg = numberOf(current, `AK${row}`);
    if (raw === null || moisture === null || dryKcalKg === null) {
      return {
        unit: index < 3 ? "S1" : "S2",
        shift: (index % 3 + 1) as 1 | 2 | 3,
        rawCoalTonnes: raw,
        moisturePercent: moisture,
        dryKcalKg,
        adjustedCoalTonnes: null,
        asReceivedKcalKg: null,
      };
    }
    return {
      unit: index < 3 ? "S1" : "S2",
      shift: (index % 3 + 1) as 1 | 2 | 3,
      rawCoalTonnes: raw,
      moisturePercent: moisture,
      dryKcalKg,
      adjustedCoalTonnes: raw * (1 - moisture / 100) / (1 - 0.085),
      asReceivedKcalKg: dryKcalKg * (1 - moisture / 100),
    };
  });
}

function calculateCoalModel(
  current: CtktktDayEntries,
  previous: CtktktDayEntries | undefined,
): CoalModelResult {
  const details = calculateCoalShiftDetails(current, previous);

  const unitResult = (start: number): CoalUnitResult => ({
    rawCoalTonnes: sum(details.slice(start, start + 3).map(item => item.rawCoalTonnes)),
    adjustedCoalTonnes: sum(details.slice(start, start + 3).map(item => item.adjustedCoalTonnes)),
  });
  const s1 = unitResult(0);
  const s2 = unitResult(3);
  const plantRaw = sum(details.map(item => item.rawCoalTonnes));
  const plantAdjusted = sum(details.map(item => item.adjustedCoalTonnes));
  const energyNumerator = details.some(item => item.rawCoalTonnes === null || item.asReceivedKcalKg === null)
    ? null
    : details.reduce((total, item) => total + (item.rawCoalTonnes ?? 0) * (item.asReceivedKcalKg ?? 0), 0);
  const averageAsReceivedKcalKg = divide(energyNumerator, plantRaw);
  const correctedKcalKg = averageAsReceivedKcalKg === null || plantRaw === null || plantAdjusted === null || plantAdjusted === 0
    ? null
    : averageAsReceivedKcalKg * plantRaw / plantAdjusted;

  return {
    s1,
    s2,
    hhvKjKg: correctedKcalKg === null ? null : correctedKcalKg * 4.1868,
  };
}

function unitKpis(
  unit: "s1" | "s2",
  current: CtktktDayEntries,
  previous: CtktktDayEntries | undefined,
  coal: CoalUnitResult,
  hhvKjKg: number | null,
): CtktktKpis {
  const isS1 = unit === "s1";
  const grossMwh = numberOf(current, isS1 ? "J157" : "J158");
  const netMwh = numberOf(current, isS1 ? "K157" : "K158");
  const auxiliaryMwh = grossMwh === null || netMwh === null ? null : grossMwh - netMwh;

  const { rawCoalTonnes, adjustedCoalTonnes } = coal;
  const netCoalRate = divide(adjustedCoalTonnes, netMwh, 1000);

  return {
    grossMwh,
    netMwh,
    auxiliaryMwh,
    auxiliaryPercent: divide(grossMwh === null || netMwh === null ? null : grossMwh - netMwh, grossMwh, 100),
    rawCoalTonnes,
    adjustedCoalTonnes,
    netCoalRate,
    netHeatRate: netCoalRate === null || hhvKjKg === null ? null : netCoalRate * hhvKjKg / 1000,
    hhvKjKg,
  };
}

function meterUnitKpis(
  unit: "s1" | "s2",
  current: CtktktDayEntries,
  previous: CtktktDayEntries | undefined,
  coal: CoalUnitResult,
  hhvKjKg: number | null,
): CtktktKpis {
  const endColumn = unit === "s1" ? "AB" : "AL";
  const grossMwh = difference(numberOf(current, `${endColumn}8`), numberOf(previous, `${endColumn}8`));
  const netMwh = difference(numberOf(current, `${endColumn}9`), numberOf(previous, `${endColumn}9`));
  const auxiliaryMwh = sum([
    difference(numberOf(current, `${endColumn}10`), numberOf(previous, `${endColumn}10`)),
    difference(numberOf(current, `${endColumn}11`), numberOf(previous, `${endColumn}11`)),
  ]);
  const { rawCoalTonnes, adjustedCoalTonnes } = coal;
  const netCoalRate = divide(adjustedCoalTonnes, netMwh, 1000);
  return {
    grossMwh,
    netMwh,
    auxiliaryMwh,
    auxiliaryPercent: divide(grossMwh === null || netMwh === null ? null : grossMwh - netMwh, grossMwh, 100),
    rawCoalTonnes,
    adjustedCoalTonnes,
    netCoalRate,
    netHeatRate: netCoalRate === null || hhvKjKg === null ? null : netCoalRate * hhvKjKg / 1000,
    hhvKjKg,
  };
}

function add(a: number | null, b: number | null) {
  return a === null || b === null ? null : a + b;
}

function combineUnitKpis(s1: CtktktKpis, s2: CtktktKpis, hhvKjKg: number | null): CtktktSummary {
  const grossMwh = add(s1.grossMwh, s2.grossMwh);
  const netMwh = add(s1.netMwh, s2.netMwh);
  const adjustedCoalTonnes = add(s1.adjustedCoalTonnes, s2.adjustedCoalTonnes);
  const rawCoalTonnes = add(s1.rawCoalTonnes, s2.rawCoalTonnes);
  const netCoalRate = divide(adjustedCoalTonnes, netMwh, 1000);
  const heatNumerator = s1.netHeatRate === null || s1.netMwh === null || s2.netHeatRate === null || s2.netMwh === null
    ? null
    : s1.netHeatRate * s1.netMwh + s2.netHeatRate * s2.netMwh;
  const plant: CtktktKpis = {
    grossMwh,
    netMwh,
    auxiliaryMwh: add(s1.auxiliaryMwh, s2.auxiliaryMwh),
    auxiliaryPercent: divide(grossMwh === null || netMwh === null ? null : grossMwh - netMwh, grossMwh, 100),
    rawCoalTonnes,
    adjustedCoalTonnes,
    netCoalRate,
    netHeatRate: divide(heatNumerator, netMwh),
    hhvKjKg,
  };
  return { s1, s2, plant };
}

export function calculateCtktktSummary(current: CtktktDayEntries, previous?: CtktktDayEntries): CtktktSummary {
  const coal = calculateCoalModel(current, previous);
  return combineUnitKpis(
    unitKpis("s1", current, previous, coal.s1, coal.hhvKjKg),
    unitKpis("s2", current, previous, coal.s2, coal.hhvKjKg),
    coal.hhvKjKg,
  );
}

export function calculateCtktktMeterSummary(current: CtktktDayEntries, previous?: CtktktDayEntries): CtktktSummary {
  const coal = calculateCoalModel(current, previous);
  return combineUnitKpis(
    meterUnitKpis("s1", current, previous, coal.s1, coal.hhvKjKg),
    meterUnitKpis("s2", current, previous, coal.s2, coal.hhvKjKg),
    coal.hhvKjKg,
  );
}

/** Mirrors Q69:Q71, P74, P75 and P77:Q77 in the source workbook. */
export function calculateNh3Summary(
  entries: CtktktDayEntries,
  grossMwh: number | null,
  netMwh: number | null,
): Nh3Summary {
  const tankMasses = NH3_TANK_ROWS.map(row => numberOf(entries, `P${row}`));
  const tankMassTotal = tankMasses.some(value => value === null) ? null : sum(tankMasses);
  const tankAvailable = tankMasses.map(value => value === null ? null : value * 0.95);
  const tankAvailableTotal = tankAvailable.some(value => value === null) ? null : sum(tankAvailable);
  // P74 is a separately entered 24h total in the source workbook. P75 uses
  // that cell directly; it does not recalculate P74 from the three tank rows.
  const stock24h = numberOf(entries, "P74")
    ?? (tankMasses.some(value => value === null) ? null : sum(tankMasses));
  const intake = numberOf(entries, "P72");
  const stock0h = numberOf(entries, "P73");
  const usedTonnes = stock0h === null || intake === null || stock24h === null
    ? null
    : stock0h + intake - stock24h;
  // The source workbook calculates P77/Q77 from the PMIS totals in G157/G158.
  // On the web those totals are represented by the two unit rows J/K 157:158.
  // Fall back to the meter-derived totals only when PMIS has not been entered.
  const pmisGrossRaw = sum([numberOf(entries, "J157"), numberOf(entries, "J158")]);
  const pmisNetRaw = sum([numberOf(entries, "K157"), numberOf(entries, "K158")]);
  // G157/G158 in Excel are reported in million kWh with four decimals, so the
  // denominator used by P77/Q77 is rounded to 0.1 MWh before division.
  const pmisGross = pmisGrossRaw === null ? null : Math.round(pmisGrossRaw * 10) / 10;
  const pmisNet = pmisNetRaw === null ? null : Math.round(pmisNetRaw * 10) / 10;
  const rateGrossMwh = pmisGross ?? grossMwh;
  const rateNetMwh = pmisNet ?? netMwh;
  return {
    tankMassTotal,
    tankAvailable,
    tankAvailableTotal,
    stock24h,
    usedTonnes,
    rateGross: divide(usedTonnes, rateGrossMwh, 1000),
    rateNet: divide(usedTonnes, rateNetMwh, 1000),
  };
}

export function previousIsoDate(date: string) {
  const parsed = new Date(`${date}T12:00:00+07:00`);
  parsed.setDate(parsed.getDate() - 1);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(parsed);
}

export type TkdHourCol = "M" | "N" | "O" | "P" | "Q" | "R";
export const TKD_HOURS: Array<{ col: TkdHourCol; label: string; hour: number }> = [
  { col: "M", label: "06h", hour: 6 },
  { col: "N", label: "10h", hour: 10 },
  { col: "O", label: "14h", hour: 14 },
  { col: "P", label: "18h", hour: 18 },
  { col: "Q", label: "22h", hour: 22 },
  { col: "R", label: "24h", hour: 24 },
];

export type TkdCalculatedRow = {
  pSumTdS1: number | null;
  pSumTdS2: number | null;
  pSumS1S2: number | null;
  pSumT1T2: number | null;
  qSumS1S2: number | null;
};

export function calculateTkdDcsSummary(entries: CtktktDayEntries): Record<TkdHourCol, TkdCalculatedRow> {
  const result = {} as Record<TkdHourCol, TkdCalculatedRow>;
  for (const { col } of TKD_HOURS) {
    const pS1 = numberOf(entries, `${col}3`);
    const qS1 = numberOf(entries, `${col}4`);
    const pS2 = numberOf(entries, `${col}5`);
    const qS2 = numberOf(entries, `${col}6`);
    const pT1 = numberOf(entries, `${col}7`);
    const pT2 = numberOf(entries, `${col}8`);
    const p911 = numberOf(entries, `${col}9`);
    const p912 = numberOf(entries, `${col}10`);
    const p921 = numberOf(entries, `${col}12`);
    const p922 = numberOf(entries, `${col}13`);

    result[col] = {
      pSumTdS1: add(p911, p912),
      pSumTdS2: add(p921, p922),
      pSumS1S2: add(pS1, pS2),
      pSumT1T2: add(pT1, pT2),
      qSumS1S2: add(qS1, qS2),
    };
  }
  return result;
}

export const OIL_HOURS = [
  { colS1: "W", colS2: "AG", label: "06h" },
  { colS1: "X", colS2: "AH", label: "08h" },
  { colS1: "Y", colS2: "AI", label: "14h" },
  { colS1: "Z", colS2: "AJ", label: "16h" },
  { colS1: "AA", colS2: "AK", label: "22h" },
  { colS1: "AB", colS2: "AL", label: "24h" },
];

export function calculateOilDifferences(
  entries: CtktktDayEntries,
  unit: "s1" | "s2",
  previous?: CtktktDayEntries,
) {
  const isS1 = unit === "s1";
  const previousEndColumn = isS1 ? "AB" : "AL";
  const unitDivisor = isS1 ? 1 : 1000;
  return OIL_HOURS.map(({ colS1, colS2, label }, index) => {
    const col = isS1 ? colS1 : colS2;
    const f1 = numberOf(entries, `${col}13`);
    const f2 = numberOf(entries, `${col}14`);
    const priorColumn = index === 0
      ? previousEndColumn
      : (isS1 ? OIL_HOURS[index - 1].colS1 : OIL_HOURS[index - 1].colS2);
    const priorEntries = index === 0 ? previous : entries;
    const priorF1 = numberOf(priorEntries, `${priorColumn}13`);
    const priorF2 = numberOf(priorEntries, `${priorColumn}14`);
    return {
      label,
      f1,
      f2,
      diff: f1 !== null && f2 !== null && priorF1 !== null && priorF2 !== null
        ? ((f1 - priorF1) - (f2 - priorF2)) / unitDivisor
        : null,
    };
  });
}

export function calculateDailyOilConsumption(
  entries: CtktktDayEntries,
  unit: "s1" | "s2",
  previous?: CtktktDayEntries,
) {
  const endColumn = unit === "s1" ? "AB" : "AL";
  const unitDivisor = unit === "s1" ? 1 : 1000;
  const currentF1 = numberOf(entries, `${endColumn}13`);
  const currentF2 = numberOf(entries, `${endColumn}14`);
  const previousF1 = numberOf(previous, `${endColumn}13`);
  const previousF2 = numberOf(previous, `${endColumn}14`);

  if (currentF1 === null || currentF2 === null || previousF1 === null || previousF2 === null) {
    return null;
  }

  return ((currentF1 - previousF1) - (currentF2 - previousF2)) / unitDivisor;
}

export type OilEventSummary = {
  phaseTonnes: Array<number | null>;
  totalTonnes: number | null;
};

function incidentOilPhase(entries: CtktktDayEntries, fromColumn: string, toColumn: string) {
  const supplyFrom = numberOf(entries, `${fromColumn}87`);
  const returnFrom = numberOf(entries, `${fromColumn}88`);
  const supplyTo = numberOf(entries, `${toColumn}87`);
  const returnTo = numberOf(entries, `${toColumn}88`);
  if (supplyFrom === null || returnFrom === null || supplyTo === null || returnTo === null) return null;
  return (supplyTo - supplyFrom) - (returnTo - returnFrom);
}

export function calculateOilEventSummary(
  entries: CtktktDayEntries,
  eventCode: CtktktOilEventCode,
): OilEventSummary {
  const columns = CTKTKT_OIL_EVENT_CONFIG[eventCode].columns.map(item => item.column);
  const phaseTonnes = columns.slice(1).map((column, index) =>
    incidentOilPhase(entries, columns[index], column),
  );
  const hasAllPhases = phaseTonnes.every((value): value is number => value !== null);
  return {
    phaseTonnes,
    totalTonnes: hasAllPhases
      ? phaseTonnes.reduce((total, value) => total + value, 0)
      : null,
  };
}

export const STEAM_HOURS = [
  { colS1: "W", colS2: "AG", label: "06h" },
  { colS1: "X", colS2: "AH", label: "10h" },
  { colS1: "Y", colS2: "AI", label: "14h" },
  { colS1: "Z", colS2: "AJ", label: "18h" },
  { colS1: "AA", colS2: "AK", label: "22h" },
  { colS1: "AB", colS2: "AL", label: "24h" },
];

export function calculateSteamDifferences(entries: CtktktDayEntries, unit: "s1" | "s2") {
  const isS1 = unit === "s1";
  const result: Array<{ label: string; totalFlow: number | null; consumption: number | null }> = [];
  let prevTotal: number | null = null;

  for (let i = 0; i < STEAM_HOURS.length; i++) {
    const { colS1, colS2, label } = STEAM_HOURS[i];
    const col = isS1 ? colS1 : colS2;
    const totalFlow = numberOf(entries, `${col}54`);
    let consumption: number | null = null;
    if (i === 0) {
      consumption = totalFlow;
    } else if (totalFlow !== null && prevTotal !== null) {
      consumption = totalFlow - prevTotal;
    }
    prevTotal = totalFlow;
    result.push({ label, totalFlow, consumption });
  }
  return result;
}
