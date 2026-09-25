import type ExcelJS from "exceljs";

const STEAM_COLUMNS = ["W", "X", "Y", "Z", "AA", "AB", "AG", "AH", "AI", "AJ", "AK", "AL"];

// Cumulative steam meters are stored at row 54 (source workbook layout).
export const CTKTKT_STEAM_METER_CELLS = new Set(STEAM_COLUMNS.map(column => `${column}54`));

export const CTKTKT_GRINDING_BALL_DEFAULT = 150;

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

function setFormula(sheet: ExcelJS.Worksheet, cell: string, formula: string) {
  sheet.getCell(cell).value = { formula };
}

const DAY_SHEET = /^\d{2}$/;
const EXTERNAL_REF = /\[\d+\]/;

function isSharedFormula(value: ExcelJS.CellValue) {
  return !!value && typeof value === "object" && ("sharedFormula" in value || "shareType" in value);
}

/**
 * Repairs defects of the embedded template that the source workbook does not have:
 * external workbook links, the E1360 typo, S2 oil meters shown in kg instead of tonnes
 * and the month-to-date column J that chained through "d-1" into previous months.
 */
export function sanitizeCtktktTemplate(workbook: ExcelJS.Workbook) {
  for (const sheet of workbook.worksheets) {
    const isPreviousMonth = sheet.name === "d-1";
    const isDaySheet = DAY_SHEET.test(sheet.name);
    // Read every (translated) formula before editing so shared-formula clones never lose their master.
    const formulas: Array<{ cell: ExcelJS.Cell; formula: string; shared: boolean }> = [];
    sheet.eachRow(row => row.eachCell(cell => {
      if (cell.formula) formulas.push({ cell, formula: cell.formula, shared: isSharedFormula(cell.value) });
    }));
    for (const { cell, formula, shared } of formulas) {
      let next: string | null = formula.replaceAll("'[2]16'!", "'16'!").replaceAll("E1360", "E139");
      if (isPreviousMonth && EXTERNAL_REF.test(next)) next = null;
      else if (isDaySheet && cell.address === "G4" && next === "AL13") next = "AL13/1000";
      else if (isDaySheet && cell.address === "G5" && next === "AL14") next = "AL14/1000";
      else if (sheet.name === "01") next =next.replace(/^I(\d+)\+#REF!J\1$/, "I$1+'d-1'!J$1");
      if (next === formula && !shared) continue;
      cell.value = next === null ? null : { formula: next };
    }
    // Source order: row 144 = "Phần trăm điện tự dùng", row 145 = "Tỷ lệ … tổn thất MBA".
    if (isDaySheet && String(sheet.getCell("B145").value).startsWith("Phần trăm điện tự dùng")) {
      for (let column = 2; column <= 9; column += 1) {
        const upper = sheet.getRow(144).getCell(column);
        const lower = sheet.getRow(145).getCell(column);
        const value = upper.value;
        upper.value = lower.value;
        lower.value = value;
      }
    }
  }
  // Month-to-date totals and running balances start from zero on day 01.
  workbook.getWorksheet("d-1")?.getColumn(10).eachCell(cell => {
    if (cell.formula) cell.value = null;
  });
}

function applyNightShiftFormulas(sheet: ExcelJS.Worksheet, next: string | null, steamRow: number, isDaySheet: boolean) {
  const ref = next ? `${quoted(next)}!` : null;
  const shifted = (meterRow: number, s1: boolean) => {
    const start = s1 ? "W" : "AG";
    const end22 = s1 ? "AA" : "AK";
    const end24 = s1 ? "AB" : "AL";
    return ref ? `${ref}${start}${meterRow}-${end22}${meterRow}` : `${end24}${meterRow}-${end22}${meterRow}`;
  };
  for (const [s1, column] of [[true, "Y"], [false, "AI"]] as const) {
    for (const meterRow of [8, 9, 10, 11]) setFormula(sheet, `${column}${41 + meterRow - 8}`, shifted(meterRow, s1));
    const coal24 = s1 ? "AB28" : "AL28";
    setFormula(sheet, `${column}46`, ref ? `${coal24}+${ref}${s1 ? "W28" : "AG28"}` : coal24);
    // Steam per-shift rates divide by the shift generation rows 41 (gross) and 42 (net).
    const steamTotal = `${column}${steamRow}`;
    setFormula(sheet, `${column}${steamRow + 1}`, `(${steamTotal}*10^6)/(${column}41*1000)`);
    setFormula(sheet, `${column}${steamRow + 2}`, `(${steamTotal}*10^6)/(${column}42*1000)`);
    const lastInterval = `${s1 ? "AB" : "AL"}${isDaySheet ? 56 : 55}`;
    // The next sheet is always a day sheet, whose cumulative steam row is 55.
    const nextStart = `${s1 ? "W" : "AG"}55`;
    setFormula(sheet, steamTotal, ref ? `${lastInterval}+${ref}${nextStart}` : lastInterval);
  }
}

/** Removes sample values baked into the template and repoints the night-shift formulas to day D+1. */
export function prepareCtktktDaySheet(sheet: ExcelJS.Worksheet, nextSheetName: string | null) {
  for (const column of STEAM_COLUMNS) sheet.getCell(`${column}55`).value = null;
  for (const cell of ["W49", "X49", "Y49", "AG49", "AH49", "AI49"]) sheet.getCell(cell).value = null;
  // Night shift = 22h–24h of day D plus 0h–6h of day D+1.
  applyNightShiftFormulas(sheet, nextSheetName, 59, true);
}

export function prepareCtktktPreviousMonthSheet(sheet: ExcelJS.Worksheet, firstDaySheetName: string) {
  applyNightShiftFormulas(sheet, firstDaySheetName, 58, false);
}

/**
 * Carries day D-1 values into day D the same way the web report does:
 * coal stock W86 = W89 of D-1 (entered only on day 01), demin meters W72/W73 = X72/X73 of D-1
 * when left blank, NH3 24h stock P74 = sum of the three tanks when not entered.
 * W87 (coal received, known only after 06h of D+1) is entered separately and never derived.
 */
export function applyCtktktDailyCarryovers(
  sheet: ExcelJS.Worksheet,
  row: Record<string, string>,
  previousRow: Record<string, string> | undefined,
  previousSheetName: string,
) {
  const isFirstDay = sheet.name === "01";
  if (!isFirstDay || numeric(row["KTKT:W86"]) === null) setFormula(sheet, "W86", `${quoted(previousSheetName)}!W89`);
  for (const [start, end] of [["W72", "X72"], ["W73", "X73"]] as const) {
    const carried = numeric(previousRow?.[`KTKT:${end}`]);
    if (numeric(row[`KTKT:${start}`]) === null && carried !== null) sheet.getCell(start).value = carried;
  }
  if (numeric(row["KTKT:P74"]) === null) setFormula(sheet, "P74", "P69+P70+P71");
  for (const cell of ["E39", "H39"]) {
    if (numeric(row[`KTKT:${cell}`]) === null) sheet.getCell(cell).value = CTKTKT_GRINDING_BALL_DEFAULT;
  }
  // Auxiliary electricity = gross − net + electricity received from the grid (as on the web).
  for (const [cell, gross, net, code] of [["L157", "J157", "K157", "GRID_RECEIVE_S1"], ["L158", "J158", "K158", "GRID_RECEIVE_S2"]] as const) {
    const received = numeric(row[code]);
    setFormula(sheet, cell, received !== null && received > 0 ? `${gross}-${net}+${received}` : `${gross}-${net}`);
  }
}

/** Latest entered value on or before the day; operating hours persist until someone updates them. */
export function applyCtktktCarriedValues(sheet: ExcelJS.Worksheet, cells: readonly string[], latest: ReadonlyMap<string, number>) {
  for (const cell of cells) {
    const value = latest.get(cell);
    if (value !== undefined) sheet.getCell(cell).value = value;
  }
}

export function ctktktDateLabelCells(isDaySheet: boolean) {
  const row = isDaySheet ? 58 : 57;
  return [`Z${row}`, `AJ${row}`];
}
