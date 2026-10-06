import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../browser-extension/qlkt-sync/background.js', import.meta.url), 'utf8');
const url = 'http://qlkt.tpcduyenhai.com.vn/qlkt/sxd/can_bang_nhiet.jsf';

test('heat-rate sync opens the canonical page without relying on remembered URLs', async () => {
  const context = vm.createContext({ DEFAULT_HEATRATE_URL: url,
    readSource: async (kind, target, date) => ({ kind, target, date }),
    chrome: { storage: { local: { get() { throw new Error('Remembered URL must not be used'); } } } },
  });
  vm.runInContext(source.slice(source.indexOf('async function syncHeatRate'), source.indexOf('async function syncBcsxEvents')) + '\nglobalThis.run = syncHeatRate;', context);
  const result = await context.run('2026-09-25');
  assert.equal(result.target, url);
  assert.equal(result.kind, 'heatrate');
});

async function navigate({ existing = false, redirect = false } = {}) {
  const calls = [];
  const chrome = { tabs: {
    query: async options => options.active ? [{ id: 1 }] : (existing ? [{ id: 2, url }] : []),
    update: async (id, options) => { calls.push({ action: 'update', id, ...options }); return { id }; },
    create: async options => { calls.push({ action: 'create', ...options }); return { id: 2 }; },
    get: async () => ({ url: redirect ? 'http://qlkt.tpcduyenhai.com.vn/qlkt/login.jsf' : url }),
    remove: async () => {},
  } };
  const entries = ['DA', 'DB', 'DC', 'DD', 'DE', 'DF', 'DG', 'DH'].map(fieldCode => ({ fieldCode, value: '1' }));
  const context = vm.createContext({ chrome, URL, QLKT_PATTERN: /^http:\/\/qlkt\.tpcduyenhai\.com\.vn\/qlkt\//,
    SOURCE_LABELS: { heatrate: 'Cân bằng nhiệt' },
    waitForTab: async () => {}, prepareDateWithRetry: async () => ({ ok: true }), wait: async () => {},
    readValuesWithRetry: async () => ({ ok: true, payload: { operatingDate: '2026-09-25', entries } }),
    missingSourceFields: () => [],
  });
  vm.runInContext(source.slice(source.indexOf('async function readSource'), source.indexOf('async function syncAll')) + '\nglobalThis.run = readSource;', context);
  const payload = await context.run('heatrate', url, '2026-09-25');
  return { calls, payload };
}

test('missing heat-rate tab is opened automatically', async () => {
  const { calls, payload } = await navigate();
  assert.ok(calls.some(call => call.action === 'create' && call.url === url && call.active));
  assert.equal(payload.entries.length, 8);
});

test('existing heat-rate tab is navigated to the canonical URL before reading', async () => {
  const { calls } = await navigate({ existing: true });
  assert.ok(calls.some(call => call.action === 'update' && call.id === 2 && call.url === url));
});

test('internal QLKT redirect is reported before trying to read a unit selector', async () => {
  await assert.rejects(navigate({ redirect: true }), /chuyển khỏi màn hình Cân bằng nhiệt.*login.jsf/);
});
