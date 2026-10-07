import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { validateQlktSyncPayload } from '../lib/qlkt-sync.ts';

// Exercise the real reader against a PrimeFaces table that clears during AJAX.
function reader({ initialDelay = 0, neverLoads = false, neverLoadsSecond = false, outageUnit, bothStopped = false, noWarning = false, zeroLoad = false, initialUnit = '1', hiddenUnit = initialUnit, partialOutage = false, wrongWarning = false, controlsDelay = 0, inputSuffix = '' } = {}) {
  const source = readFileSync(new URL('../browser-extension/qlkt-sync/content.js', import.meta.url), 'utf8');
  let now = 0, readyAt = initialDelay;
  let widgetUnit = initialUnit;
  const widgetSelections = [];
  const ajaxSelections = [];
  const cell = textContent => ({ textContent });
  const row = texts => ({ cells: texts.map(cell), textContent: texts.join(' ') });
  const labels = { rows: [row(['Tên đại lượng', 'Ký hiệu']), ...['PG', 'L1', 'Pbn', 'T'].map(symbol => row(['Thông số', symbol]))] };
  const select = {
    id: `formMain:cbSelectMainAsset${inputSuffix}`, value: `MF${hiddenUnit}`,
    options: [{ value: 'MF1', textContent: 'DH1_MF1' }, { value: 'MF2', textContent: 'DH1_MF2' }],
    get selectedIndex() { return this.value === 'MF1' ? 0 : 1; },
    dispatchEvent(event) { if (event.type === 'change') readyAt = now + 1500; },
  };
  const document = {
    body: { get innerText() {
      return !noWarning && now >= readyAt && widgetUnit === outageUnit
        ? `Dừng sự cố: DH1_MF${wrongWarning ? '2' : outageUnit} (2026-09-21 09:56:00 - 2026-09-25 03:30:00)` : '';
    } },
    getElementById(id) { return id === 'formMain:cbSelectMainAsset_label' ? { textContent: `DH1_MF${widgetUnit}` } : null; },
    querySelectorAll(selector) {
      if (selector === 'select') return now >= controlsDelay ? [select] : [];
      if (selector === 'table') {
        const ready = now >= readyAt && !neverLoads && !(neverLoadsSecond && widgetUnit === '2');
        const numbers = widgetUnit === '1' ? ['500,12', '4,58', '-93,21', '29,96'] : ['510,34', '4,68', '-93,38', '29,60'];
        return [labels, { rows: [row(['Trung bình']), ...numbers.map((value, index) => row([
          ready && !bothStopped && (widgetUnit !== outageUnit || (partialOutage && index === 0)) ? value : (index === 0 && zeroLoad ? '0,00' : ''),
        ]))] }];
      }
      return [];
    },
  };
  const page = vm.createContext({ document,
    Date: { now: () => now }, setTimeout(callback, ms) { now += ms; callback(); },
    PrimeFaces: { ajax: { Queue: { isEmpty: () => now >= readyAt && !neverLoads && !(neverLoadsSecond && widgetUnit === '2') } }, getWidgetById(id) { return id === 'formMain:cbSelectMainAsset' ? { selectValue(value) {
      widgetSelections.push(value);
      select.value = value;
      widgetUnit = value.endsWith('2') ? '2' : '1';
      // Real PrimeFaces selectValue updates the control silently, without AJAX.
    }, triggerChange() {
      ajaxSelections.push(select.value);
      select.dispatchEvent(new Event('change'));
    } } : null; } },
  });
  const background = readFileSync(new URL('../browser-extension/qlkt-sync/background.js', import.meta.url), 'utf8');
  vm.runInContext(background.slice(background.indexOf('function selectHeatRateUnitInPage'), background.indexOf('async function selectHeatRateUnitForTab')) + '\nglobalThis.selectUnit = selectHeatRateUnitInPage;', page);
  vm.runInContext(background.slice(background.indexOf('async function waitForHeatRateAjaxInPage'), background.indexOf('async function waitForHeatRateAjaxForTab')) + '\nglobalThis.waitReady = waitForHeatRateAjaxInPage;', page);
  // The extension's isolated world deliberately has no PrimeFaces global.
  const context = vm.createContext({ document, location: { href: 'http://qlkt/can_bang_nhiet.jsf' },
    chrome: { runtime: { async sendMessage(message) {
      if (message.type === 'WAIT_QLKT_HEATRATE_READY') return page.waitReady().catch(error => ({ ok: false, error: error.message }));
      assert.equal(message.type, 'SELECT_QLKT_HEATRATE_UNIT');
      return page.selectUnit(message.unit);
    } } },
    Date: { now: () => now }, Event: class { constructor(type) { this.type = type; } },
    setTimeout(callback, ms) { now += ms; callback(); },
  });
  const helpers = source.slice(source.indexOf('  const cleanText'), source.indexOf('  const normalizeQlktNumber'));
  const functions = source.slice(source.indexOf('  function findColumnTableByHeader'), source.indexOf('  function extractPpaMeterPayload'));
  vm.runInContext(`${helpers}\n${functions}\nglobalThis.read = extractHeatRatePayload;`, context);
  return { read: () => context.read('2026-09-25'), selected: () => select.value, widgetSelections, ajaxSelections, elapsed: () => now };
}

test('heat-rate sync waits for all four values after AJAX clears the other unit table', async () => {
  const fixture = reader();
  const payload = await fixture.read();
  assert.equal(payload.entries.length, 8);
  assert.equal(payload.entries.find(entry => entry.fieldCode === 'DD').value, '4.68');
  assert.equal(payload.entries.find(entry => entry.fieldCode === 'DE').value, '-93.21');
  assert.equal(fixture.selected(), 'MF1');
});

test('heat-rate sync also waits for the initially selected unit after date refresh', async () => {
  const fixture = reader({ initialDelay: 1500 });
  assert.equal((await fixture.read()).entries.length, 8);
});

test('heat-rate sync follows visible PrimeFaces unit when hidden select is already ahead', async () => {
  const fixture = reader({ initialUnit: '1', hiddenUnit: '2' });
  const payload = await fixture.read();
  assert.equal(payload.entries.length, 8);
  assert.equal(payload.entries.find(entry => entry.fieldCode === 'DD').value, '4.68');
  assert.ok(fixture.widgetSelections.includes('MF2'));
  assert.equal(fixture.selected(), 'MF1');
});

test('isolated reader triggers real page AJAX for a PrimeFaces _input selector', async () => {
  const fixture = reader({ inputSuffix: '_input' });
  const payload = await fixture.read();
  assert.equal(payload.entries.find(entry => entry.fieldCode === 'DB').value, '510.34');
  assert.deepEqual(fixture.ajaxSelections, ['MF2', 'MF1']);
  assert.ok(fixture.elapsed() < 4000, 'no extra table read when restoring the original selection');
});

test('S2 timeout restores selection immediately rather than waiting through another timeout', async () => {
  const fixture = reader({ neverLoadsSecond: true });
  await assert.rejects(fixture.read(), /DH1_MF2.*vẫn đang tải/);
  assert.equal(fixture.selected(), 'MF1');
  assert.ok(fixture.elapsed() < 15000);
});

test('heat-rate sync waits for the unit selector to render before reading either unit', async () => {
  assert.equal((await reader({ controlsDelay: 1800 }).read()).entries.length, 8);
});

test('missing selector reports the actual source page after bounded waiting', async () => {
  await assert.rejects(reader({ controlsDelay: Infinity }).read(), /Trang đang mở: http:\/\/qlkt\/can_bang_nhiet.jsf/);
});

test('heat-rate sync rejects missing values instead of returning a partial successful payload', async () => {
  await assert.rejects(reader({ neverLoads: true }).read(), /DH1_MF1/);
});

test('S1 outage with four blank averages does not block complete S2 readings', async () => {
  for (const initialUnit of ['1', '2']) {
    const fixture = reader({ outageUnit: '1', initialUnit });
    const payload = await fixture.read();
    assert.deepEqual(Array.from(payload.entries, item => item.fieldCode), ['DB', 'DD', 'DF', 'DH']);
    assert.deepEqual(Array.from(payload.unavailableHeatRateUnits), ['1']);
    assert.equal(payload.entries.find(item => item.fieldCode === 'DD').value, '4.68');
    assert.equal(fixture.selected(), `MF${initialUnit}`);
    assert.ok(fixture.widgetSelections.includes('MF2'));
    assert.equal(validateQlktSyncPayload(payload)?.entries.length, 4);
  }
});

test('S2 outage does not block S1 and never fabricates zeros for S2', async () => {
  const payload = await reader({ outageUnit: '2' }).read();
  assert.deepEqual(Array.from(payload.entries, item => item.fieldCode), ['DA', 'DC', 'DE', 'DG']);
  assert.deepEqual(Array.from(payload.unavailableHeatRateUnits), ['2']);
});

test('running PG still rejects incomplete metrics; missing PG does not require an outage banner', async () => {
  await assert.rejects(reader({ outageUnit: '1', partialOutage: true }).read(), /DH1_MF1/);
  assert.deepEqual(Array.from((await reader({ outageUnit: '1', wrongWarning: true }).read()).unavailableHeatRateUnits), ['1']);
});

test('06/10 S2 with blank or zero PG and no outage banner synchronizes S1 only', async () => {
  for (const zeroLoad of [false, true]) {
    const payload = await reader({ outageUnit: '2', noWarning: true, zeroLoad }).read();
    assert.deepEqual(Array.from(payload.unavailableHeatRateUnits), ['2']);
    assert.deepEqual(Array.from(payload.entries, entry => entry.fieldCode), ['DA', 'DC', 'DE', 'DG']);
    assert.ok(validateQlktSyncPayload(payload));
  }
});

test('both stopped with identical blank tables is a valid read without fabricated values', async () => {
  const payload = await reader({ bothStopped: true, noWarning: true }).read();
  assert.equal(payload.entries.length, 0);
  assert.deepEqual(Array.from(payload.unavailableHeatRateUnits), ['1', '2']);
  assert.ok(validateQlktSyncPayload(payload));
  assert.equal(validateQlktSyncPayload({ ...payload, unavailableHeatRateUnits: ['1'] }), null);
});

test('empty AJAX request queue with an in-flight XHR is not a completed table load', async () => {
  const background = readFileSync(new URL('../browser-extension/qlkt-sync/background.js', import.meta.url), 'utf8');
  let now = 0;
  const queue = { isEmpty: () => true, xhrs: [{}] };
  const page = vm.createContext({ PrimeFaces: { ajax: { Queue: queue } }, Date: { now: () => now },
    setTimeout(callback, ms) { now += ms; if (now >= 450) queue.xhrs = []; callback(); },
  });
  vm.runInContext(background.slice(background.indexOf('async function waitForHeatRateAjaxInPage'), background.indexOf('async function waitForHeatRateAjaxForTab')) + '\nglobalThis.waitReady = waitForHeatRateAjaxInPage;', page);
  const result = await page.waitReady();
  assert.equal(result.ajaxVerified, true);
  assert.equal(now, 450);
});

test('background permits missing stopped-unit fields only with all four running-unit fields', () => {
  const source = readFileSync(new URL('../browser-extension/qlkt-sync/background.js', import.meta.url), 'utf8');
  const context = vm.createContext({});
  vm.runInContext(source.slice(source.indexOf('const REQUIRED_FIELDS'), source.indexOf('const wait =')) + '\nglobalThis.check = missingSourceFields;', context);
  const s2 = ['DB', 'DD', 'DF', 'DH'].map(fieldCode => ({ fieldCode, value: '1', sourceLabel: 'QLKT' }));
  assert.equal(context.check('heatrate', { entries: s2, unavailableHeatRateUnits: ['1'] }).length, 0);
  assert.equal(context.check('heatrate', { entries: s2 }).length, 4);
  assert.ok(context.check('heatrate', { entries: s2.slice(1), unavailableHeatRateUnits: ['1'] }).length);
  assert.equal(context.check('heatrate', { entries: [], unavailableHeatRateUnits: ['1', '2'] }).length, 0);
  assert.equal(validateQlktSyncPayload({ version: 1, operatingDate: '2026-09-25', sourcePage: 'QLKT',
    entries: s2, unavailableHeatRateUnits: ['2'] }), null);
});
