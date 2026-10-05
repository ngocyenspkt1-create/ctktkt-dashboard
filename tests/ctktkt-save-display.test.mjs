import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { calculateNh3Summary } from '../lib/ctktkt-report.ts';
import { canEditCtktktField } from '../lib/ctktkt-permissions.ts';

const source = readFileSync(new URL('../components/ctktkt-report.tsx', import.meta.url), 'utf8');

test('NH3 closing stock remains available after loading saved tank entries without P74', () => {
  const saved = JSON.parse(JSON.stringify({ P69: '10.1', P70: '20.2', P71: '30.3', P72: '5', P73: '65' }));
  assert.ok(Math.abs(calculateNh3Summary(saved, null, null).stock24h - 60.6) < 1e-9);
  assert.match(source, /data-nh3-stock-24h[\s\S]{0,150}format\(nh3\.stock24h\)/);
  assert.match(source, /renderCellInput\("P74", \{ group: "nh3_tank" \}\)/);
});

test('a saved explicit P74 takes priority after reload and both authorized roles can edit it', () => {
  const saved = JSON.parse(JSON.stringify({ P69: '10', P70: '20', P71: '30', P74: '57.5' }));
  assert.equal(calculateNh3Summary(saved, null, null).stock24h, 57.5);
  assert.equal(canEditCtktktField({ role: 'admin', permissions: [] }, 'P74'), true);
  assert.equal(canEditCtktktField({ role: 'editor', position: 'Trưởng kíp điện', permissions: ['edit_daily'] }, 'P74'), true);
});

test('unsaved inputs block date switching and page reload warns before losing edits', () => {
  assert.match(source, /onChange=\{value => \{[\s\S]{0,130}dirtyCellsRef\.current\.size > 0 \|\| saving[\s\S]{0,180}return;[\s\S]{0,110}setDate\(value\)/);
  assert.match(source, /addEventListener\("beforeunload", warnBeforeLeaving\)/);
  assert.match(source, /if \(!dirty && !saving\) return;[\s\S]{0,100}event\.preventDefault\(\)/);
});

test('save success still requires reading back and comparing submitted cells', () => {
  assert.match(source, /const verifyResponse = await fetch/);
  assert.match(source, /const mismatches = toSend\.filter/);
  assert.match(source, /if \(mismatches\.length\) \{[\s\S]{0,350}throw new Error/);
});
