import { isCoalStock24hStartEntryRequired, COAL_STOCK_24H_START_CELL } from "./coal-stock.ts";
import { CTKTKT_CARRY_FORWARD_INPUT_CELLS } from "./ctktkt-extra-fields.ts";

/** Returns false when a blank field is filled automatically by the report rules. */
export function shouldShowCtktktMissingField(
  cell: string,
  date: string,
  entriesByDate: Readonly<Record<string, Readonly<Record<string, string>>>>,
) {
  if (cell === COAL_STOCK_24H_START_CELL && !isCoalStock24hStartEntryRequired(date)) return false;
  if (!CTKTKT_CARRY_FORWARD_INPUT_CELLS.has(cell)) return true;

  return !Object.keys(entriesByDate).some(earlierDate => {
    if (earlierDate >= date) return false;
    const raw = entriesByDate[earlierDate]?.[cell]?.trim().replace(/\s/g, "").replace(",", ".");
    return raw !== undefined && raw !== "" && Number.isFinite(Number(raw));
  });
}
