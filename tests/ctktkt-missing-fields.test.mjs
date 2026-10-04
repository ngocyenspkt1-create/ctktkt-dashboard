import assert from "node:assert/strict";
import test from "node:test";
import { shouldShowCtktktMissingField } from "../lib/ctktkt-missing-fields.ts";

test("the monthly coal stock opening is required only on day 01", () => {
  assert.equal(shouldShowCtktktMissingField("COAL_STOCK_24H_START", "2026-09-01", {}), true);
  assert.equal(shouldShowCtktktMissingField("COAL_STOCK_24H_START", "2026-09-02", {}), false);
});

test("calculated PMIS stock opening and imported operating hours are not manual missing inputs", () => {
  assert.equal(shouldShowCtktktMissingField("W86", "2026-10-02", {}), false);
  assert.equal(shouldShowCtktktMissingField("W86", "2026-10-01", {}), true);
  for (const cell of ["W68", "Y68", "Z68", "W69", "X69", "Y69", "Z69"]) {
    assert.equal(shouldShowCtktktMissingField(cell, "2026-10-02", {}), false);
  }
});

test("a carry-forward input is not reported missing when an earlier numeric reading exists", () => {
  assert.equal(shouldShowCtktktMissingField("M24", "2026-09-03", {
    "2026-09-01": { M24: "125.4" },
    "2026-09-02": { M24: "" },
  }), false);
});

test("a carry-forward input is reported when there is no earlier usable reading", () => {
  assert.equal(shouldShowCtktktMissingField("M24", "2026-09-03", {
    "2026-09-01": { M24: "" },
    "2026-09-02": { M24: "unknown" },
  }), true);
});

test("ordinary required inputs remain in the missing-data alert", () => {
  assert.equal(shouldShowCtktktMissingField("M3", "2026-09-03", {}), true);
});
