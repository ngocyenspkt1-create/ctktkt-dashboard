import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the real reader against a PrimeFaces table that clears during AJAX.
function reader({ initialDelay = 0, neverLoads = false } = {}) {
  const source = readFileSync(new URL('../browser-extension/qlkt-sync/content.js', import.meta.url), 'utf8');
  let now = 0, readyAt = initialDelay;
  const cell = textContent => ({ textContent });
  const row = texts => ({ cells: texts.map(cell), textContent: texts.join(' ') });
  const labels = { rows: [row(['Tên đại lượng', 'Ký hiệu']), ...['PG', 'L1', 'Pbn', 'T'].map(symbol => row(['Thông số', symbol]))] };
  const select = {
    id: 'formMain:cbSelectMainAsset', value: 'MF1',
    options: [{ value: 'MF1', textContent: 'DH1_MF1' }, { value: 'MF2', textContent: 'DH1_MF2' }],
    get selectedIndex() { return this.value === 'MF1' ? 0 : 1; },
    dispatchEvent(event) { if (event.type === 'change') readyAt = now + 1500; },
  };
  const document = {
    getElementById() { return null; },
    querySelectorAll(selector) {
      if (selector === 'select') return [select];
      if (selector === 'table') {
        const ready = now >= readyAt && !neverLoads;
        const numbers = select.value === 'MF1' ? ['500,12', '4,58', '-93,21', '29,96'] : ['510,34', '4,68', '-93,38', '29,60'];
        return [labels, { rows: [row(['Trung bình']), ...numbers.map(value => row([ready ? value : '']))] }];
      }
      return [];
    },
  };
  const context = vm.createContext({ document, location: { href: 'http://qlkt/can_bang_nhiet.jsf' },
    Date: { now: () => now }, Event: class { constructor(type) { this.type = type; } },
    setTimeout(callback, ms) { now += ms; callback(); },
  });
  const helpers = source.slice(source.indexOf('  const cleanText'), source.indexOf('  const normalizeQlktNumber'));
  const functions = source.slice(source.indexOf('  function findColumnTableByHeader'), source.indexOf('  function extractPpaMeterPayload'));
  vm.runInContext(`${helpers}\n${functions}\nglobalThis.read = extractHeatRatePayload;`, context);
  return { read: () => context.read('2026-09-25'), selected: () => select.value };
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

test('heat-rate sync rejects missing values instead of returning a partial successful payload', async () => {
  await assert.rejects(reader({ neverLoads: true }).read(), /DH1_MF1/);
});
