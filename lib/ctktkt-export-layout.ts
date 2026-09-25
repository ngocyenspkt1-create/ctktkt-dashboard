import type ExcelJS from "exceljs";

const STEAM_COLUMNS = ["W", "X", "Y", "Z", "AA", "AB", "AG", "AH", "AI", "AJ", "AK", "AL"];

// Cumulative steam meters are stored at row 54 (source workbook layout).
export const CTKTKT_STEAM_METER_CELLS = new Set(STEAM_COLUMNS.map(column => `${column}54`));

// Day sheets 01–31 of the embedded template carry the steam block one row lower
// than the source workbook ("d-1" keeps the source layout).
export function ctktktExportCell(cell: string, isDaySheet: boolean): string {
  return isDaySheet && CTKTKT_STEAM_METER_CELLS.has(cell) ? cell.replace(/54$/, "55") : cell;
}

function quoted(sheetName: string) {
  return `'${sheetName.replaceAll("'", "''")}'`;
}

function numeric(value: string | undefined) {
  if (!value?.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Removes sample values baked into the template and repoints the night-shift steam formulas. */
export function prepareCtktktDaySheet(sheet: ExcelJS.Worksheet, nextSheetName: string | null) {
  for (const column of STEAM_COLUMNS) sheet.getCell(`${column}55`).value = null;
  for (const cell of ["W49", "X49", "Y49", "AG49", "AH49", "AI49"]) sheet.getCell(cell).value = null;
  // Night shift = 22h–24h of day D plus 0h–6h of day D+1.
  sheet.getCell("Y59").value = { formula: nextSheetName ? `AB56+${quoted(nextSheetName)}!W55` : "AB56" };
  sheet.getCell("AI59").value = { formula: nextSheetName ? `AL56+${quoted(nextSheetName)}!AG55` : "AL56" };
}

export function prepareCtktktPreviousMonthSheet(sheet: ExcelJS.Worksheet, firstDaySheetName: string) {
  sheet.getCell("Y58").value = { formula: `AB55+${quoted(firstDaySheetName)}!W55` };
  sheet.getCell("AI58").value = { formula: `AL55+${quoted(firstDaySheetName)}!AG55` };
}

/**
 * Carries day D-1 values into day D the same way the web report does:
 * coal stock W86 = W89 of D-1, demin meters W72/W73 = X72/X73 of D-1 when left blank,
 * NH3 24h stock P74 = sum of the three tanks when not entered, coal intake W87 = I36.
 */
export function applyCtktktDailyCarryovers(
  sheet: ExcelJS.Worksheet,
  row: Record<string, string>,
  previousRow: Record<string, string> | undefined,
  previousSheetName: string,
) {
  sheet.getCell("W86").value = { formula: `${quoted(previousSheetName)}!W89` };
  if (numeric(row["KTKT:W87"]) === null && numeric(row["KTKT:I36"]) !== null) sheet.getCell("W87").value = { formula: "I36" };
  for (const [start, end] of [["W72", "X72"], ["W73", "X73"]] as const) {
    const carried = numeric(previousRow?.[`KTKT:${end}`]);
    if (numeric(row[`KTKT:${start}`]) === null && carried !== null) sheet.getCell(start).value = carried;
  }
  if (numeric(row["KTKT:P74"]) === null) sheet.getCell("P74").value = { formula: "P69+P70+P71" };
}

export function ctktktDateLabelCells(isDaySheet: boolean) {
  const row = isDaySheet ? 58 : 57;
  return [`Z${row}`, `AJ${row}`];
}
