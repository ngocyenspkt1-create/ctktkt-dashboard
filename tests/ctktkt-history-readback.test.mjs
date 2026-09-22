import test from "node:test";
import assert from "node:assert/strict";
import {
  ctktktHistoryValuesEqual,
  findCtktktHistoryReadbackMismatch,
} from "../lib/ctktkt-history-readback.ts";

test("history readback accepts equivalent numeric formats including zero", () => {
  assert.equal(ctktktHistoryValuesEqual("0.0000", "0"), true);
  assert.equal(ctktktHistoryValuesEqual("20.9467", "20,9467"), true);
  assert.equal(ctktktHistoryValuesEqual(undefined, ""), true);
});

test("history readback reports the exact first mismatched cell", () => {
  const mismatch = findCtktktHistoryReadbackMismatch(
    [{ date: "2026-09-05", manualEntries: [{ cell: "D181", value: "20.9467" }, { cell: "E181", value: "0" }] }],
    [{ operatingDate: "2026-09-05", cell: "D181", value: "20.9467" }],
  );

  assert.deepEqual(mismatch, {
    date: "2026-09-05",
    cell: "E181",
    expected: "0",
    actual: undefined,
  });
});
