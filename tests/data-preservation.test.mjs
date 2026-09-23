import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("CTKTKT saves only dirty cells and PMIS sync preserves unrelated edits", () => {
  const source = readFileSync(new URL("../components/ctktkt-report.tsx", import.meta.url), "utf8");
  const apiSource = readFileSync(new URL("../app/api/ctktkt-report/route.ts", import.meta.url), "utf8");
  assert.match(source, /dirtyCellsRef\.current\.add\(cell\)/);
  assert.match(source, /const dirtyCells = \[\.\.\.dirtyCellsRef\.current\]/);
  assert.doesNotMatch(source, /editableFields\s*\n\s*\.filter\(field => canEditCtktktField/);
  assert.doesNotMatch(source, /setByDate\(old =>[\s\S]{0,350}setDirty\(false\);\s*try \{/);
  assert.doesNotMatch(apiSource, /for \(const cell of CTKTKT_(?:BCSX|WATER)_LINKED_CELLS\) statements\.push/);
});

test("BCSX and water manual saves send only fields changed by the user", () => {
  const bcsxSource = readFileSync(new URL("../components/bcsx-report.tsx", import.meta.url), "utf8");
  const waterSource = readFileSync(new URL("../components/water-report-client.tsx", import.meta.url), "utf8");
  const waterApiSource = readFileSync(new URL("../app/api/water-report/route.ts", import.meta.url), "utf8");
  assert.match(bcsxSource, /dirtyReadingsRef\.current\.add/);
  assert.match(bcsxSource, /const dirtyKeys = \[\.\.\.dirtyReadingsRef\.current\]/);
  assert.doesNotMatch(bcsxSource, /SHIFT_METRICS\.flatMap\(m => SHIFT_TIME_SLOTS\.map/);
  assert.match(waterSource, /changedFields: editingShift\.id \? \[\.\.\.dirtyShiftFieldsRef\.current\]/);
  assert.match(waterApiSource, /const shouldUpdate = \(field: keyof WaterShiftLog\)/);
});

test("automatic BCSX imports do not delete stored events when a unit has no incoming events", () => {
  const syncSource = readFileSync(new URL("../app/api/bcsx-sync/route.ts", import.meta.url), "utf8");
  const importSource = readFileSync(new URL("../app/api/bcsx-operation-import/route.ts", import.meta.url), "utf8");
  assert.match(syncSource, /\.\.\.\(s1Events\.length \? \[/);
  assert.match(syncSource, /\.\.\.\(s2Events\.length \? \[/);
  assert.match(importSource, /\.\.\.\(importResult\.events\.S1\.length \? \[/);
  assert.match(importSource, /\.\.\.\(importResult\.events\.S2\.length \? \[/);
});

test("linked daily fields are read-only sources and are not persisted a second time", () => {
  const dailyApiSource = readFileSync(new URL("../app/api/daily-inputs/route.ts", import.meta.url), "utf8");
  const bcsxSyncSource = readFileSync(new URL("../app/api/bcsx-sync/route.ts", import.meta.url), "utf8");
  assert.match(dailyApiSource, /CTKTKT_LINKED_DAILY_CODES\.has\(fieldCode\)/);
  assert.match(bcsxSyncSource, /entriesToPersist = entries\.filter\(entry => !CTKTKT_LINKED_DAILY_CODES\.has/);
});
