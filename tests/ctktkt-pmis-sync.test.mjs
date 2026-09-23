import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PMIS_PRODUCTION_CELLS,
  sanitizeCtktktPmisSyncEntries,
} from "../lib/ctktkt-pmis-sync.ts";

test("PMIS sync removes monthly QLKT codes returned by an old extension", () => {
  const sanitized = sanitizeCtktktPmisSyncEntries([
    { cell: "B", value: "100" },
    { cell: "C", value: "90" },
    { cell: "H", value: "200" },
    { cell: "I", value: "180" },
    { cell: "J157", value: "120.5" },
    { cell: "K157", value: "110.5" },
    { cell: "J158", value: "121.5" },
    { cell: "K158", value: "111.5" },
    { cell: "C181", value: "1245" },
    { cell: "T181", value: "Đạt" },
  ]);

  assert.deepEqual(sanitized.map(entry => entry.cell), [
    ...PMIS_PRODUCTION_CELLS,
    "C181",
    "T181",
  ]);
  assert.equal(sanitized.some(entry => ["B", "C", "H", "I"].includes(entry.cell)), false);
});

test("PMIS sync ignores blank, malformed and duplicate values safely", () => {
  const sanitized = sanitizeCtktktPmisSyncEntries([
    null,
    { cell: "J157", value: "" },
    { cell: "J157", value: "100" },
    { cell: "J157", value: "101" },
    { cell: "UNKNOWN", value: "1" },
  ]);

  assert.deepEqual(sanitized, [{ cell: "J157", value: "101" }]);
});
