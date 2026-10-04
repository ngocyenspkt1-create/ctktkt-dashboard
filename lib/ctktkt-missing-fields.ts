import { isCoalStock24hStartEntryRequired, COAL_STOCK_24H_START_CELL } from "./coal-stock.ts";
import { CTKTKT_CARRY_FORWARD_INPUT_CELLS, CTKTKT_OPERATING_HOURS_CELLS } from "./ctktkt-extra-fields.ts";
import { CTKTKT_INSTALLED_CAPACITY_CELL } from "./ctktkt-defaults.ts";
import { PMIS_PRODUCTION_CELLS } from "./ctktkt-pmis-sync.ts";
import { NH3_DCS_START_METER_CELLS, NH3_START_LEVEL_CELLS } from "./ctktkt-report.ts";

/** Returns false when a blank field is filled automatically by the report rules. */
export function shouldShowCtktktMissingField(
  cell: string,
  date: string,
  entriesByDate: Readonly<Record<string, Readonly<Record<string, string>>>>,
) {
  if (cell === COAL_STOCK_24H_START_CELL) return isCoalStock24hStartEntryRequired(date);
  if (
    (PMIS_PRODUCTION_CELLS as readonly string[]).includes(cell)
    || cell === CTKTKT_INSTALLED_CAPACITY_CELL
    || NH3_START_LEVEL_CELLS.has(cell)
    || NH3_DCS_START_METER_CELLS.has(cell)
  ) return false;
  if (cell === "W86" && !isCoalStock24hStartEntryRequired(date)) return false;
  if ((CTKTKT_OPERATING_HOURS_CELLS as readonly string[]).includes(cell)) return false;
  if (!CTKTKT_CARRY_FORWARD_INPUT_CELLS.has(cell)) return true;

  return !Object.keys(entriesByDate).some(earlierDate => {
    if (earlierDate >= date) return false;
    const raw = entriesByDate[earlierDate]?.[cell]?.trim().replace(/\s/g, "").replace(",", ".");
    return raw !== undefined && raw !== "" && Number.isFinite(Number(raw));
  });
}
