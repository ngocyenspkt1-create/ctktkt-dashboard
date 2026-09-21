import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CTKTKT_COAL_ADJUSTMENT_FIELDS,
  CTKTKT_COAL_BLEND_FIELDS,
  CTKTKT_NON_WORKBOOK_INPUT_CELLS,
  CTKTKT_TEXT_INPUT_CELLS,
  getCtktktCoalAdjustmentNotes,
  normalizeCtktktInputValue,
} from "../lib/ctktkt-extra-fields.ts";

test("coal input fields use the plant shift order: 08h Ca 1, 16h Ca 2, 24h Ca 3", () => {
  assert.deepEqual(
    CTKTKT_COAL_ADJUSTMENT_FIELDS.slice(0, 3).map((field) => field.label),
    ["S1 Ca 1 (00h-08h)", "S1 Ca 2 (08h-16h)", "S1 Ca 3 (16h-24h)"],
  );
  assert.deepEqual(
    CTKTKT_COAL_ADJUSTMENT_FIELDS.slice(3, 6).map((field) => field.label),
    ["S2 Ca 1 (00h-08h)", "S2 Ca 2 (08h-16h)", "S2 Ca 3 (16h-24h)"],
  );
  assert.deepEqual(CTKTKT_COAL_BLEND_FIELDS, []);
});

test("coal adjustment reasons are text-only fields outside worksheet cell addresses", () => {
  for (const field of ["COAL_ADJ_NOTE_S1", "COAL_ADJ_NOTE_S2"]) {
    assert.equal(CTKTKT_TEXT_INPUT_CELLS.has(field), true);
    assert.equal(CTKTKT_NON_WORKBOOK_INPUT_CELLS.has(field), true);
  }
});

test("coal adjustment reasons preserve Vietnamese text, commas and decimal amounts", () => {
  assert.equal(
    normalizeCtktktInputValue("COAL_ADJ_NOTE_S1", " Máy cấp 1B1, cộng 12,5 tấn "),
    "Máy cấp 1B1, cộng 12,5 tấn",
  );
  assert.equal(normalizeCtktktInputValue("W28", "12,5"), "12.5");
});

test("coal adjustment reasons become comments on all three shift adjustment cells", () => {
  const notes = getCtktktCoalAdjustmentNotes({
    "KTKT:COAL_ADJ_NOTE_S1": "Máy cấp 1B1, cộng 12,5 tấn do cân lệch",
    "KTKT:COAL_ADJ_NOTE_S2": "Máy cấp 2A2, trừ 8,0 tấn sau kiểm tra",
  });
  assert.equal(notes.W28, "Lý do hiệu chỉnh S1: Máy cấp 1B1, cộng 12,5 tấn do cân lệch");
  assert.equal(notes.Y28, notes.W28);
  assert.equal(notes.AA28, notes.W28);
  assert.equal(notes.AG28, "Lý do hiệu chỉnh S2: Máy cấp 2A2, trừ 8,0 tấn sau kiểm tra");
  assert.equal(notes.AI28, notes.AG28);
  assert.equal(notes.AK28, notes.AG28);
});
