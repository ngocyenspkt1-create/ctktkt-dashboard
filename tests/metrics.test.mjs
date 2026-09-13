import assert from 'node:assert/strict';
import { test } from 'node:test';
import { metrics, numberInput, validateMeasurement } from '../lib/metrics.ts';

const base = { period: '2026-08', note: '', metricCode: 'TUDUNG', gross: '1000000', exported: '920200' };
test('Electricity is calculated on the server; client results and limits are ignored', () => {
  const result = validateMeasurement({ ...base, actual: 999, limitValue: 999 });
  assert.equal(Number(result.actual), 7.98);
  assert.equal(Number(result.limitValue), 7.98);
  assert.match(result.note, /1000000 kWh/);
});
test('All material metrics use kg to g conversion and preserve their denominator', () => {
  for (const metric of metrics.filter(m => m.code !== 'TUDUNG')) {
    const result = validateMeasurement({ ...base, metricCode: metric.code, mass: '2,5', denominator: '1000' });
    assert.equal(Number(result.actual), 2.5);
    assert.match(result.note, metric.code === 'BI_NGHIEN' ? /than=1000 tấn/ : /điện xuất tuyến=1000 kWh/);
  }
});
test('Blank, null, boolean, Infinity and ambiguous numbers are not zero', () => {
  for (const value of ['', ' ', null, true, Infinity, '1,000.2', '1.000.000', 'abc']) assert.throws(() => numberInput(value));
  assert.equal(numberInput('0'), 0);
  assert.equal(numberInput('0,0128'), 0.0128);
});
test('Invalid periods, metrics, negative quantities and zero denominator are rejected', () => {
  for (const period of ['2026-00', '2026-13', '', '26-08']) assert.throws(() => validateMeasurement({ ...base, period }));
  for (const change of [{ metricCode: 'FAKE' }, { gross: 0 }, { exported: -1 }, { exported: 1000001 }, { note: 'x'.repeat(1001) }]) assert.throws(() => validateMeasurement({ ...base, ...change }));
  for (const change of [{ mass: -1 }, { denominator: 0 }, { mass: null }, { denominator: '' }]) assert.throws(() => validateMeasurement({ ...base, metricCode: 'PAC', mass: 0, denominator: 100, ...change }));
});
test('At threshold is achieved; above threshold exceeds without rounding', () => {
  assert.equal(Number(validateMeasurement(base).actual) > 7.98, false);
  assert.equal(Number(validateMeasurement({ ...base, exported: '920199' }).actual) > 7.98, true);
});
