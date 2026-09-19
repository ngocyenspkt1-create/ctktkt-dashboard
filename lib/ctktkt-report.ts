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
};

export type CtktktSummary = { s1: CtktktKpis; s2: CtktktKpis; plant: CtktktKpis };

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

function weightedAverage(values: Array<{ value: number | null; weight: number | null }>) {
  if (values.some(item => item.value === null || item.weight === null)) return null;
  const totalWeight = values.reduce((total, item) => total + (item.weight ?? 0), 0);
  if (!totalWeight) return null;
  return values.reduce((total, item) => total + (item.value ?? 0) * (item.weight ?? 0), 0) / totalWeight;
}

function unitKpis(
  unit: "s1" | "s2",
  current: CtktktDayEntries,
  previous: CtktktDayEntries | undefined,
): CtktktKpis {
  const isS1 = unit === "s1";
  const endColumn = isS1 ? "AB" : "AL";
  const mid1Column = isS1 ? "X" : "AH";
  const mid2Column = isS1 ? "Z" : "AJ";
  const moistureRows = isS1 ? [87, 88, 89] : [90, 91, 92];
  const grossMwh = difference(numberOf(current, `${endColumn}8`), numberOf(previous, `${endColumn}8`));
  const netMwh = difference(numberOf(current, `${endColumn}9`), numberOf(previous, `${endColumn}9`));
  const auxiliary1 = difference(numberOf(current, `${endColumn}10`), numberOf(previous, `${endColumn}10`));
  const auxiliary2 = difference(numberOf(current, `${endColumn}11`), numberOf(previous, `${endColumn}11`));
  const auxiliaryMwh = sum([auxiliary1, auxiliary2]);

  const previousCoal = meterSum(previous, endColumn);
  const firstCoal = difference(meterSum(current, mid1Column), previousCoal);
  const secondCoal = difference(meterSum(current, mid2Column), meterSum(current, mid1Column));
  const thirdCoal = difference(meterSum(current, endColumn), meterSum(current, mid2Column));
  const rawShifts = [firstCoal, secondCoal, thirdCoal];
  const adjustedShifts = rawShifts.map((raw, index) => {
    const moisture = numberOf(current, `AJ${moistureRows[index]}`);
    return raw === null || moisture === null ? null : raw * (1 - moisture / 100) / 0.915;
  });
  const rawCoalTonnes = sum(rawShifts);
  const adjustedCoalTonnes = sum(adjustedShifts);
  const netCoalRate = divide(adjustedCoalTonnes, netMwh, 1000);
  const hhvKjKg = weightedAverage(moistureRows.map((row, index) => {
    const dryKcalKg = numberOf(current, `AK${row}`);
    const moisture = numberOf(current, `AJ${row}`);
    return {
      value: dryKcalKg === null || moisture === null ? null : dryKcalKg * (1 - moisture / 100) * 4.1868,
      weight: rawShifts[index],
    };
  }));

  return {
    grossMwh,
    netMwh,
    auxiliaryMwh,
    auxiliaryPercent: divide(grossMwh === null || netMwh === null ? null : grossMwh - netMwh, grossMwh, 100),
    rawCoalTonnes,
    adjustedCoalTonnes,
    netCoalRate,
    netHeatRate: netCoalRate === null || hhvKjKg === null ? null : netCoalRate * hhvKjKg / 1000,
  };
}

function add(a: number | null, b: number | null) {
  return a === null || b === null ? null : a + b;
}

export function calculateCtktktSummary(current: CtktktDayEntries, previous?: CtktktDayEntries): CtktktSummary {
  const s1 = unitKpis("s1", current, previous);
  const s2 = unitKpis("s2", current, previous);
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
  };
  return { s1, s2, plant };
}

export function previousIsoDate(date: string) {
  const parsed = new Date(`${date}T12:00:00+07:00`);
  parsed.setDate(parsed.getDate() - 1);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(parsed);
}
