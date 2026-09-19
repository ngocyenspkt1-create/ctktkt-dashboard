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
  tankAvailable: Array<number | null>;
  stock24h: number | null;
  usedTonnes: number | null;
  rateGross: number | null;
  rateNet: number | null;
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
 * Mirrors the source workbook rows AG:AT 83:92.
 *
 * The workbook first converts each shift's coal to the 8.5% moisture basis,
 * including the optional Sub-bituminous blend (AL/AO). It then derives one
 * common daily HHV at the corrected-mass basis and uses that same HHV for S1,
 * S2 and the whole plant.
 */
function calculateCoalModel(
  current: CtktktDayEntries,
  previous: CtktktDayEntries | undefined,
): CoalModelResult {
  const s1Raw = coalRawShifts("s1", current, previous);
  const s2Raw = coalRawShifts("s2", current, previous);
  const rows = [87, 88, 89, 90, 91, 92];
  const rawShifts = [...s1Raw, ...s2Raw];

  const details = rawShifts.map((raw, index) => {
    const row = rows[index];
    const moisture = numberOf(current, `AJ${row}`);
    const dryKcalKg = numberOf(current, `AK${row}`);
    if (raw === null || moisture === null || dryKcalKg === null) {
      return { raw, adjusted: null, asReceivedKcalKg: null };
    }

    // Excel treats an empty blend ratio/moisture cell as zero.
    const blendRatio = numberOf(current, `AL${row}`) ?? 0;
    const blendMoisture = numberOf(current, `AO${row}`) ?? 0;
    const domesticRaw = raw * (1 - blendRatio);
    const blendRaw = raw * blendRatio;
    const correctedDomesticMoisture = blendRaw > 0
      ? (domesticRaw === 0 ? null : (raw * moisture - blendRaw * blendMoisture) / domesticRaw)
      : moisture;
    const adjustedDomestic = correctedDomesticMoisture === null
      ? null
      : domesticRaw * (1 - correctedDomesticMoisture / 100) / (1 - 0.085);

    return {
      raw,
      adjusted: adjustedDomestic === null ? null : adjustedDomestic + blendRaw,
      asReceivedKcalKg: dryKcalKg * (1 - moisture / 100),
    };
  });

  const unitResult = (start: number): CoalUnitResult => ({
    rawCoalTonnes: sum(details.slice(start, start + 3).map(item => item.raw)),
    adjustedCoalTonnes: sum(details.slice(start, start + 3).map(item => item.adjusted)),
  });
  const s1 = unitResult(0);
  const s2 = unitResult(3);
  const plantRaw = sum(details.map(item => item.raw));
  const plantAdjusted = sum(details.map(item => item.adjusted));
  const energyNumerator = details.some(item => item.raw === null || item.asReceivedKcalKg === null)
    ? null
    : details.reduce((total, item) => total + (item.raw ?? 0) * (item.asReceivedKcalKg ?? 0), 0);
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
  const endColumn = isS1 ? "AB" : "AL";
  const grossMwh = difference(numberOf(current, `${endColumn}8`), numberOf(previous, `${endColumn}8`));
  const netMwh = difference(numberOf(current, `${endColumn}9`), numberOf(previous, `${endColumn}9`));
  const auxiliary1 = difference(numberOf(current, `${endColumn}10`), numberOf(previous, `${endColumn}10`));
  const auxiliary2 = difference(numberOf(current, `${endColumn}11`), numberOf(previous, `${endColumn}11`));
  const auxiliaryMwh = sum([auxiliary1, auxiliary2]);

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

export function calculateCtktktSummary(current: CtktktDayEntries, previous?: CtktktDayEntries): CtktktSummary {
  const coal = calculateCoalModel(current, previous);
  const s1 = unitKpis("s1", current, previous, coal.s1, coal.hhvKjKg);
  const s2 = unitKpis("s2", current, previous, coal.s2, coal.hhvKjKg);
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
    hhvKjKg: coal.hhvKjKg,
  };
  return { s1, s2, plant };
}

/** Mirrors Q69:Q71, P74, P75 and P77:Q77 in the source workbook. */
export function calculateNh3Summary(
  entries: CtktktDayEntries,
  grossMwh: number | null,
  netMwh: number | null,
): Nh3Summary {
  const tankMasses = [69, 70, 71].map(row => numberOf(entries, `P${row}`));
  const stock24h = tankMasses.some(value => value === null) ? null : sum(tankMasses);
  const intake = numberOf(entries, "P72");
  const stock0h = numberOf(entries, "P73");
  const usedTonnes = stock0h === null || intake === null || stock24h === null
    ? null
    : stock0h + intake - stock24h;
  return {
    tankAvailable: tankMasses.map(value => value === null ? null : value * 0.95),
    stock24h,
    usedTonnes,
    rateGross: divide(usedTonnes, grossMwh, 1000),
    rateNet: divide(usedTonnes, netMwh, 1000),
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
        ? (f1 - priorF1) - (f2 - priorF2)
        : null,
    };
  });
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
