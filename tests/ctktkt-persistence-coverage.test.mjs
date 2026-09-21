import assert from "node:assert/strict";
import { test } from "node:test";
import { CTKTKT_INPUT_FIELDS } from "../lib/ctktkt-fields.generated.ts";
import { CTKTKT_EXTRA_INPUT_FIELDS } from "../lib/ctktkt-extra-fields.ts";
import { CTKTKT_BCSX_LINKED_CELLS } from "../lib/ctktkt-bcsx-link.ts";
import { CTKTKT_WATER_LINKED_CELLS } from "../lib/ctktkt-water-link.ts";
import { getGroupCells } from "../lib/ctktkt-permissions.ts";

const groups = [
  "kpi_summary",
  "tkd_trend",
  "tpd_tcd_power",
  "lo_pho_oil",
  "may_nghien_coal_s1",
  "may_nghien_coal_s2",
  "steam_flow",
  "nh3_tank",
  "td21",
  "startup_shutdown",
  "coal_blend_pmis",
  "pmis_reports",
];

test("every editable CTKTKT cell is included in the persistence allow-list", () => {
  const persistable = new Set([
    ...CTKTKT_INPUT_FIELDS.map(field => field.cell),
    ...CTKTKT_EXTRA_INPUT_FIELDS.map(field => field.cell),
  ]);
  const missing = [];

  for (const group of groups) {
    for (const cell of getGroupCells(group)) {
      if (CTKTKT_BCSX_LINKED_CELLS.has(cell) || CTKTKT_WATER_LINKED_CELLS.has(cell)) continue;
      if (!persistable.has(cell)) missing.push(`${group}:${cell}`);
    }
  }

  assert.deepEqual(missing, []);
});

test("blank-template fields reported by users are persisted", () => {
  const persistable = new Set(CTKTKT_EXTRA_INPUT_FIELDS.map(field => field.cell));
  for (const cell of [
    "I35",
    "M15", "N15", "O15", "P15", "Q15", "R15",
    "M16", "N16", "R16",
    "C87", "E87", "F87", "G87",
    "C88", "D88", "E88", "F88", "G88",
    "C93", "D93", "E93", "F93", "G93",
    "C94", "D94", "E94", "F94", "G94",
  ]) assert.equal(persistable.has(cell), true, `${cell} must be persisted`);
});
