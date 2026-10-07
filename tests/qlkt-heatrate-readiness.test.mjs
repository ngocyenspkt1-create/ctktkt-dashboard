import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { validateQlktSyncPayload } from '../lib/qlkt-sync.ts';

// Exercise the real reader against a PrimeFaces table that clears during AJAX.
function reader({ initialDelay = 0, neverLoads = false, outageUnit, initialUnit = '1', partialOutage = false, wrongWarning = false, controlsDelay = 0 } = {}) {
  const source = readFileSync(new URL('../browser-extension/qlkt-sync/content.js', import.meta.url), 'utf8');
  let now = 0, readyAt = initialDelay;
  const widgetSelections = [];
  const cell = textContent => ({ textContent });
  const row = texts => ({ cells: texts.map(cell), textContent: texts.join(' ') });
  const labels = { rows: [row(['Tên đại lượng', 'Ký hiệu']), ...['PG', 'L1', 'Pbn', 'T'].map(symbol => row(['Thông số', symbol]))] };
  const select = {
    id: 'formMain:cbSelectMainAsset', value: `MF${initialUnit}`,
    options: [{ value: 'MF1', textContent: 'DH1_MF1' }, { value: 'MF2', textContent: 'DH1_MF2' }],
    get selectedIndex() { return this.value === 'MF1' ? 0 : 1; },
    dispatchEvent(event) { if (event.type === 'change') readyAt = now + 1500; },
  };
  const document = {
    body: { get innerText() {
      return now >= readyAt && select.value === `MF${outageUnit}`
        ? `Dừng sự cố: DH1_MF${wrongWarning ? '2' : outageUnit} (2026-09-21 09:56:00 - 2026-09-25 03:30:00)` : '';
    } },
    getElementById() { return null; },
    querySelectorAll(selector) {
      if (selector === 'select') return now >= controlsDelay ? [select] : [];
      if (selector === 'table') {
        const ready = now >= readyAt && !neverLoads;
        const numbers = select.value === 'MF1' ? ['500,12', '4,58', '-93,21', '29,96'] : ['510,34', '4,68', '-93,38', '29,60'];
        return [labels, { rows: [row(['Trung bình']), ...numbers.map((value, index) => row([
          ready && (select.value !== `MF${outageUnit}` || (partialOutage && index === 0)) ? value : '',
        ]))] }];
      }
      return [];
    },
  };
  const context = vm.createContext({ document, location: { href: 'http://qlkt/can_bang_nhiet.jsf' },
    PrimeFaces: { getWidgetById(id) { return id === select.id ? { selectValue(value) {
      widgetSelections.push(value);
      select.value = value;
      select.dispatchEvent(new Event('change'));
    } } : null; } },
    Date: { now: () => now }, Event: class { constructor(type) { this.type = type; } },
    setTimeout(callback, ms) { now += ms; callback(); },
  });
  const helpers = source.slice(source.indexOf('  const cleanText'), source.indexOf('  const normalizeQlktNumber'));
  const functions = source.slice(source.indexOf('  function findColumnTableByHeader'), source.indexOf('  function extractPpaMeterPayload'));
  vm.runInContext(`${helpers}\n${functions}\nglobalThis.read = extractHeatRatePayload;`, context);
  return { read: () => context.read('2026-09-25'), selected: () => select.value, widgetSelections };
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

test('outage warning does not excuse partial values or a warning for the wrong unit', async () => {
  await assert.rejects(reader({ outageUnit: '1', partialOutage: true }).read(), /DH1_MF1/);
  await assert.rejects(reader({ outageUnit: '1', wrongWarning: true }).read(), /DH1_MF1/);
});

test('background permits missing stopped-unit fields only with all four running-unit fields', () => {
  const source = readFileSync(new URL('../browser-extension/qlkt-sync/background.js', import.meta.url), 'utf8');
  const context = vm.createContext({});
  vm.runInContext(source.slice(source.indexOf('const REQUIRED_FIELDS'), source.indexOf('const wait =')) + '\nglobalThis.check = missingSourceFields;', context);
  const s2 = ['DB', 'DD', 'DF', 'DH'].map(fieldCode => ({ fieldCode, value: '1', sourceLabel: 'QLKT' }));
  assert.equal(context.check('heatrate', { entries: s2, unavailableHeatRateUnits: ['1'] }).length, 0);
  assert.equal(context.check('heatrate', { entries: s2 }).length, 4);
  assert.ok(context.check('heatrate', { entries: s2.slice(1), unavailableHeatRateUnits: ['1'] }).length);
  assert.ok(context.check('heatrate', { entries: [], unavailableHeatRateUnits: ['1', '2'] }).length);
  assert.equal(validateQlktSyncPayload({ version: 1, operatingDate: '2026-09-25', sourcePage: 'QLKT',
    entries: s2, unavailableHeatRateUnits: ['2'] }), null);
});
