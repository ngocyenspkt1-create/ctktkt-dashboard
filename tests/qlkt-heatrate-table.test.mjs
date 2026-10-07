import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../browser-extension/qlkt-sync/content.js', import.meta.url), 'utf8');
const cell = (textContent, colSpan = 1, rowSpan = 1) => ({ textContent, colSpan, rowSpan });
const row = (cells, key = null) => ({ cells, textContent: cells.map(item => item.textContent).join(' '), getAttribute: name => name === 'data-ri' ? key : null });
const symbols = ['PG', 'L1', 'Pbn', 'T'];
const averages = ['510,34', '4,68', '-93,38', '29,60'];

function snapshot(tables) {
  const context = vm.createContext({ document: { querySelectorAll: selector => selector === 'table' ? tables : [] } });
  const helpers = source.slice(source.indexOf('  const cleanText'), source.indexOf('  const normalizeQlktNumber'));
  const functions = source.slice(source.indexOf('  function findColumnTableByHeader'), source.indexOf('  function extractPpaMeterPayload'));
  vm.runInContext(`${helpers}\n${functions}\nglobalThis.readSnapshot = readHeatRateSnapshotForCurrentUnit;`, context);
  return () => context.readSnapshot('2');
}

function frozen({ inputValues = false, load = averages[0], reorder = false, missingPG = false, fewerValues = false } = {}) {
  const root = {};
  const left = {}, right = {};
  const make = (headers, bodyRows, side) => ({
    rows: [...headers, ...bodyRows], tHead: { rows: headers }, tBodies: bodyRows.length ? [{ rows: bodyRows }] : [],
    closest: selector => selector === '.ui-datatable' ? root : selector.includes('frozenlayout') ? side : null,
  });
  const indices = [0, 1, 2, 3].filter(index => !missingPG || index !== 0);
  const labelRows = indices.map(index => row([cell(String(index + 1)), cell('Thông số'), cell(symbols[index])], String(index)));
  let valueRows = indices.map(index => {
    const raw = index === 0 ? load : averages[index];
    const average = inputValues ? { ...cell(''), querySelector: () => ({ value: raw, getAttribute: () => raw }) } : cell(raw);
    return row([cell('111'), cell('222'), cell('333'), average], String(index));
  });
  if (reorder) valueRows.reverse();
  if (fewerValues) valueRows.pop();
  const labelHeader = make([row([cell('STT'), cell('Tên đại lượng'), cell('Ký hiệu')])], [], left);
  const labelBody = make([], labelRows, left);
  const valueHeader = make([row([cell('Ngày', 4)]), row(['Ca sáng', 'Ca chiều', 'Ca khuya', 'Trung bình'].map(text => cell(text)))], [], right);
  const valueBody = make([], valueRows, right);
  left.querySelectorAll = () => [labelBody];
  right.querySelectorAll = () => [valueBody];
  root.querySelectorAll = () => [labelBody, valueBody];
  return [labelHeader, labelBody, valueHeader, valueBody];
}

test('frozen PrimeFaces reads separate header/body tables despite different header row counts', () => {
  const result = snapshot(frozen())();
  assert.equal(result.unavailable, false);
  assert.deepEqual(Array.from(result.entries, entry => entry.value), ['510.34', '4.68', '-93.38', '29.6']);
});

test('frozen tables match metric data by row identity rather than DOM order', () => {
  const result = snapshot(frozen({ reorder: true }))();
  assert.equal(result.entries.find(entry => entry.fieldCode === 'DB').value, '510.34');
  assert.equal(result.entries.find(entry => entry.fieldCode === 'DD').value, '4.68');
});

test('reads the live input value when average cells have no textContent', () => {
  assert.equal(snapshot(frozen({ inputValues: true }))().entries.find(entry => entry.fieldCode === 'DB').value, '510.34');
});

test('combined table resolves average column after rowspan labels and grouped headers', () => {
  const headers = [
    row([cell('STT', 1, 2), cell('Tên đại lượng', 1, 2), cell('Ký hiệu', 1, 2), cell('Ngày', 4)]),
    row(['Ca sáng', 'Ca chiều', 'Ca khuya', 'Trung bình'].map(text => cell(text))),
  ];
  const bodyRows = symbols.map((symbol, index) => row([cell(String(index)), cell('Thông số'), cell(symbol), cell('111'), cell('222'), cell('333'), cell(averages[index])]));
  const table = { rows: [...headers, ...bodyRows], tHead: { rows: headers }, tBodies: [{ rows: bodyRows }] };
  assert.equal(snapshot([table])().entries.find(entry => entry.fieldCode === 'DB').value, '510.34');
});

test('blank PG in the average column means stopped without reading another numeric column', () => {
  const result = snapshot(frozen({ load: '' }))();
  assert.equal(result.unavailable, true);
  assert.equal(result.entries.length, 0);
});

test('missing PG row and unequal data regions remain read errors, never stopped units', () => {
  assert.throws(snapshot(frozen({ missingPG: true })), /hàng PG/);
  assert.throws(snapshot(frozen({ fewerValues: true })), /Số hàng hai vùng không khớp/);
});

test('malformed PG is a read error rather than an absent load', () => {
  assert.throws(snapshot(frozen({ load: 'đang tải' })), /không phải số/);
});
