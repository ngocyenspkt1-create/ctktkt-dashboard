import test from "node:test";
import assert from "node:assert/strict";
import { buildQlktRangeEntries, listIsoDates } from "../lib/qlkt-range-sync.ts";

test("date range crosses month and year ends", () => {
  assert.deepEqual(listIsoDates("2025-12-30", "2026-01-02"), ["2025-12-30", "2025-12-31", "2026-01-01", "2026-01-02"]);
  assert.deepEqual(listIsoDates("2026-02-27", "2026-03-01"), ["2026-02-27", "2026-02-28", "2026-03-01"]);
  assert.deepEqual(listIsoDates("2026-03-02", "2026-03-01"), []);
});

test("range entries skip blank QLKT values and keep existing notes", () => {
  const entries = buildQlktRangeEntries(
    "2026-09-22",
    [{ fieldCode: "F", value: "0" }, { fieldCode: "GRID_RECEIVE_S1", value: "315.5203" }, { fieldCode: "CC", value: "" }],
    new Map([["2026-09-22|F", "S1 sự cố"]]),
  );
  assert.deepEqual(entries, [
    { operatingDate: "2026-09-22", fieldCode: "F", value: "0", note: "S1 sự cố" },
    { operatingDate: "2026-09-22", fieldCode: "GRID_RECEIVE_S1", value: "315.5203", note: "" },
  ]);
});
