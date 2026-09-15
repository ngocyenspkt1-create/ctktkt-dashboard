import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeQlktPpaSyncHash, validateQlktPpaSyncPayload } from '../lib/qlkt-sync.ts';
import '../public/qlkt-sync-extension/meter-extract.js';

const headers = ['', 'Tên điểm đo', 'Kênh', 'Ngày', 'Nguồn dữ liệu', 'Tổng', ...Array.from({ length: 48 }, (_, index) => `H${index + 1}`)];
const meterRows = ['DHA_S1', 'DH1_285M', 'DHA_S2', 'DH1_283M'].map((meter, meterIndex) => {
  const intervals = Array.from({ length: 48 }, (_, index) => 200000 + meterIndex * 1000 + index);
  return ['', meter, 'kWhGiao', '14/09/2026', 'File CSV', String(intervals.reduce((sum, value) => sum + value, 0)), ...intervals.map(String)];
});

test('extracts the four PPA meters and all 48 intervals from the QLKT table', () => {
  const payload = globalThis.QlktMeterExtractor.extractPpaMeterReadings([[headers], meterRows.map(row => row.slice(1))], '2026-09-14', 'http://qlkt/example');
  assert.equal(payload.kind, 'ppa-meter');
  assert.equal(payload.readings.length, 4);
  assert.deepEqual(payload.readings.map(item => item.meter), ['DHA_S1', 'DH1_285M', 'DHA_S2', 'DH1_283M']);
  assert.ok(payload.readings.every(item => item.intervals.length === 48));
});

test('rejects a QLKT table whose interval sum does not match Total', () => {
  const broken = meterRows.map(row => [...row]);
  broken[0][5] = '1';
  assert.throws(() => globalThis.QlktMeterExtractor.extractPpaMeterReadings([[headers, ...broken]], '2026-09-14'), /không khớp cột Tổng/);
});

test('extracts the four PPA meters from the ExtSheet <script> data QLKT embeds in the page (real page shape)', () => {
  // Mô phỏng đúng cấu trúc thật của QLKT: dữ liệu nằm trong thẻ <script> khởi
  // tạo widget "ExtSheet", mỗi điểm đo có 4 dòng (kWhGiao/kWhNhan/kVarhGiao/
  // kVarhNhan), tên điểm đo có thể có khoảng trắng đệm ở cuối, và bảng hiển
  // thị trên DOM chỉ vẽ một phần rất nhỏ số cột/dòng này (nên không dùng ở đây).
  const channels = ['kWhGiao', 'kWhNhan', 'kVarhGiao', 'kVarhNhan'];
  const meters = ['DHA_S1', 'DH1_285M', 'DHA_S2', 'DH1_283M'];
  const rows = [['Điểm đo giao nhận', '', '', '', '', ...Array.from({ length: 48 }, () => '')]];
  meters.forEach((meter, meterIndex) => {
    channels.forEach(channel => {
      if (channel !== 'kWhGiao') {
        rows.push([meter.padEnd(50, ' '), channel, '14/09/2026', 'File CSV', '0', ...Array.from({ length: 48 }, () => '0')]);
        return;
      }
      const intervals = Array.from({ length: 48 }, (_, index) => 200000 + meterIndex * 1000 + index);
      const total = intervals.reduce((sum, value) => sum + value, 0);
      rows.push([meter.padEnd(50, ' '), channel, '14/09/2026', 'File CSV', String(total), ...intervals.map(String)]);
    });
  });
  const scriptText = `$(function(){PrimeFaces.cw("ExtSheet","sheetWidget",{id:"formMain:sheet",errors:"{}",data:${JSON.stringify(rows)}},"formMain:sheet")});`;

  const payload = globalThis.QlktMeterExtractor.extractPpaMeterReadingsFromScripts([scriptText], '2026-09-14', 'http://qlkt/example');
  assert.equal(payload.kind, 'ppa-meter');
  assert.equal(payload.readings.length, 4);
  assert.deepEqual(payload.readings.map(item => item.meter), ['DHA_S1', 'DH1_285M', 'DHA_S2', 'DH1_283M']);
  assert.ok(payload.readings.every(item => item.intervals.length === 48 && item.channel === 'kWhGiao'));
});

test('script-based extractor rejects when no ExtSheet data is present on the page', () => {
  assert.throws(
    () => globalThis.QlktMeterExtractor.extractPpaMeterReadingsFromScripts(['console.log("no data here")'], '2026-09-14'),
    /Không tìm thấy dữ liệu bảng công tơ/
  );
});

test('web app decodes a complete PPA payload and rejects missing meters', () => {
  const payload = globalThis.QlktMeterExtractor.extractPpaMeterReadings([[headers, ...meterRows]], '2026-09-14', 'http://qlkt/example');
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const decoded = decodeQlktPpaSyncHash(`#qlkt-sync=${encoded}`);
  assert.equal(decoded?.readings.length, 4);
  assert.equal(validateQlktPpaSyncPayload(payload)?.readings.length, 4);
  const incomplete = { ...payload, readings: payload.readings.slice(0, 3) };
  assert.equal(decodeQlktPpaSyncHash(`#qlkt-sync=${Buffer.from(JSON.stringify(incomplete)).toString('base64url')}`), null);
});
