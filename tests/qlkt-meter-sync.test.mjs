import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeQlktPpaSyncHash, validateQlktPpaSyncPayload, validateQlktUnifiedSyncPayload } from '../lib/qlkt-sync.ts';
import { isQlktExtensionOutdated, QLKT_EXTENSION_DOWNLOAD_URL, REQUIRED_QLKT_EXTENSION_VERSION } from '../lib/qlkt-extension-version.ts';
import '../public/qlkt-sync-extension/meter-extract.js';

test('web blocks old QLKT extensions and prefers reload over downloading again', () => {
  assert.equal(REQUIRED_QLKT_EXTENSION_VERSION, '0.4.29');
  assert.equal(isQlktExtensionOutdated('0.4.28'), true);
  assert.equal(isQlktExtensionOutdated('0.4.29'), false);
  assert.equal(isQlktExtensionOutdated('0.4.29'), false);
  assert.equal(isQlktExtensionOutdated(''), false);
  assert.match(QLKT_EXTENSION_DOWNLOAD_URL, /qlkt-sync-extension\.zip\?v=0\.4\.29/);
  const dailySource = readFileSync(new URL('../components/daily-production-table.tsx', import.meta.url), 'utf8');
  assert.match(dailySource, /Ưu tiên Reload — không cần tải lại mỗi lần/);
  assert.match(dailySource, /Đã Reload — kiểm tra lại/);
  assert.doesNotMatch(dailySource, /document\.createElement\("a"\)/);
});

test('extension package 0.4.29 syncs only direct monthly QLKT sources', () => {
  const files = ['background.js', 'content.js', 'manifest.json', 'meter-extract.js', 'popup.css', 'popup.html', 'popup.js', 'README.md', 'web-bridge.js'];
  for (const file of files) {
    const source = readFileSync(new URL(`../browser-extension/qlkt-sync/${file}`, import.meta.url), 'utf8');
    const published = readFileSync(new URL(`../public/qlkt-sync-extension/${file}`, import.meta.url), 'utf8');
    assert.equal(published, source, `${file} phải giống nhau ở bản nguồn và bản phát hành`);
  }
  const manifest = JSON.parse(readFileSync(new URL('../public/qlkt-sync-extension/manifest.json', import.meta.url), 'utf8'));
  const background = readFileSync(new URL('../public/qlkt-sync-extension/background.js', import.meta.url), 'utf8');
  const content = readFileSync(new URL('../public/qlkt-sync-extension/content.js', import.meta.url), 'utf8');
  const popup = readFileSync(new URL('../public/qlkt-sync-extension/popup.js', import.meta.url), 'utf8');
  const webBridge = readFileSync(new URL('../public/qlkt-sync-extension/web-bridge.js', import.meta.url), 'utf8');
  assert.equal(manifest.version, '0.4.29');
  assert.ok(manifest.host_permissions.includes('https://ctktkt-dashboard.vercel.app/*'));
  assert.ok(manifest.content_scripts.some(item => item.js.includes('web-bridge.js') && item.matches.includes('https://ctktkt-dashboard.vercel.app/*')));
  assert.match(webBridge, /\/bcsx-report/);
  assert.match(webBridge, /SYNC_BCSX_EVENTS/);
  assert.match(webBridge, /SYNC_UNIFIED/);
  assert.match(popup, /DEFAULT_TARGET_URL = "https:\/\/ctktkt-dashboard\.vercel\.app\/"/);
  assert.match(background, /DEFAULT_OPERATION_URL = "http:\/\/qlkt\.tpcduyenhai\.com\.vn\/qlkt\/sxd\/rpt_hour_operation\.jsf"/);
  assert.match(background, /SYNC_BCSX_EVENTS_QLKT/);
  assert.match(background, /SYNC_UNIFIED_QLKT/);
  assert.match(background, /async function syncUnified\(operatingDate\)/);
  assert.match(content, /CONTENT_SCRIPT_VERSION = "0\.4\.29"/);
  assert.match(background, /DAILY_SOURCES = \["fuel", "operation"\]/);
  assert.match(background, /DAILY_FIELD_CODES = new Set\(\["F", "L", "AR", "CC", "CD", "CS", "CT", "CU", "CV"\]\)/);
  assert.match(background, /fuel: \["AR", "CC", "CD"\]/);
  assert.match(background, /operation: \["F", "L", "CS", "CT", "CU", "CV"\]/);
  assert.match(background, /source === "operation" \? DEFAULT_OPERATION_URL/);
  assert.match(content, /const firstUnit = originalUnit \|\| "1"/);
  assert.match(content, /cbSelectMainAsset/);
  assert.match(content, /extractOperatingEvents/);
  assert.match(content, /classifyEventUnit/);
  assert.match(background, /prepareDateWithRetry/);
  assert.match(background, /readMeterFromPageWorldWithRetry/);
  assert.match(background, /async function waitForTab\(tabId, timeout = 60000\)/);
  assert.match(background, /document\.readyState/);
  assert.match(content, /visibleReportDateInputs/);
  assert.match(content, /HTMLInputElement\.prototype/);
  assert.doesNotMatch(content, /parseDate\(expectedOperatingDate\) \|\| expectedOperatingDate/);
  assert.match(content, /sessionStorage\.setItem\(PREPARED_DATE_KEY, operatingDate\)/);
  assert.match(content, /preparedDate === expectedOperatingDate/);
  assert.match(content, /aligned \|\| sameIndex/);
  // Nút "cập nhật ngày" từng bị dò NHẦM trên toàn trang (không giới hạn vị trí)
  // và bấm trúng menu điều hướng "Cập nhật sản lượng bù trừ" — giờ mọi cách dò
  // đều phải nằm gần ô ngày (isNearDateRow) và loại trừ rõ "bù trừ".
  assert.match(content, /isNearDateRow/);
  assert.match(content, /bu tru/);
  // "rpt_a_bu_tru_day.jsf" (Cập nhật sản lượng bù trừ) từng bị nhận nhầm là
  // màn hình Sản lượng do trùng cụm từ trong nội dung — loại trừ tường minh.
  assert.match(content, /path\.includes\("bu_tru"\)\) return null/);
  // Địa chỉ Sản lượng giờ cố định (đã xác nhận trên hệ thống thật), không còn
  // phụ thuộc "ghi nhớ" — tránh lặp lại lỗi mở nhầm trang bù trừ.
  assert.match(background, /DEFAULT_PRODUCTION_URL = "http:\/\/qlkt\.tpcduyenhai\.com\.vn\/qlkt\/sxd\/rpt_a_production_day\.jsf"/);
  assert.match(background, /source === "production" \? DEFAULT_PRODUCTION_URL/);
  assert.match(content, /candidate\.rect\.left > label\.rect\.left/);
  assert.match(content, /s1\[0\].*SL phát/);
  assert.match(content, /s1\[2\].*SL điểm bán/);
  assert.match(background, /READ_QLKT_VALUES", operatingDate/);
  assert.match(content, /retryable: message\.includes\("nút cập nhật ngày"\)/);
  // Mọi màn hình QLKT (không riêng Công tơ PPA) đều phải mở ở tab đang xem
  // (active:true) — QLKT trì hoãn dựng bảng nặng ở tab chạy nền, từng gây lỗi
  // "0 chỉ tiêu" ngẫu nhiên cho màn hình Sản lượng.
  assert.match(background, /tab = await chrome\.tabs\.create\(\{ url, active: true \}\)/);
  assert.doesNotMatch(background, /active: isMeter/);
  // Khi không đọc được chỉ tiêu nào, thông báo lỗi phải kèm URL/tiêu đề trang
  // thực tế để chẩn đoán được ngay nếu tiện ích lỡ mở nhầm trang.
  assert.match(content, /Trang hiện tại: "\$\{document\.title/);
});

test('BCSX imports operating events from the dispatch workbook and sources Section 2 totals from CTKTKT', () => {
  const source = readFileSync(new URL('../components/bcsx-report.tsx', import.meta.url), 'utf8');
  const dailySource = readFileSync(new URL('../components/daily-production-table.tsx', import.meta.url), 'utf8');
  const ctktktSource = readFileSync(new URL('../components/ctktkt-report.tsx', import.meta.url), 'utf8');
  const importRoute = readFileSync(new URL('../app/api/bcsx-operation-import/route.ts', import.meta.url), 'utf8');
  const background = readFileSync(new URL('../public/qlkt-sync-extension/background.js', import.meta.url), 'utf8');
  const webBridge = readFileSync(new URL('../public/qlkt-sync-extension/web-bridge.js', import.meta.url), 'utf8');
  assert.match(source, /Nhập file lệnh & xuất QLKT/);
  assert.match(source, /\/api\/bcsx-operation-import/);
  assert.doesNotMatch(source, /type: "SYNC_BCSX_EVENTS"/);
  assert.match(dailySource, /type:"SYNC_ALL"/);
  assert.doesNotMatch(dailySource, /type:"SYNC_UNIFIED"/);
  assert.match(source, /\/api\/ctktkt-report/);
  assert.match(source, /deriveDailyValuesFromCtktkt/);
  assert.match(source, /BCSX_COAL_STOCK_24H_CODE/);
  assert.doesNotMatch(source, /byCode\.get\("AR"\)/);
  assert.match(ctktktSource, /SYNC_PMIS_02PD/);
  assert.match(background, /async function syncPmis02Pd\(operatingDate\)/);
  assert.match(background, /SYNC_PMIS_02PD_QLKT/);
  assert.match(background, /cell: entry\.cell \|\| entry\.fieldCode/);
  assert.match(background, /missingProduction = \["J157", "K157", "J158", "K158"\]/);
  assert.match(webBridge, /SYNC_PMIS_02PD/);
  assert.match(importRoute, /parseOperationCommandWorkbook/);
  assert.match(importRoute, /requirePermission\("edit_bcsx"\)/);
});

test('each report keeps its intended data action and NH3 overlaps link from CTKTKT', () => {
  const dailySource = readFileSync(new URL('../components/daily-production-table.tsx', import.meta.url), 'utf8');
  const bcsxSource = readFileSync(new URL('../components/bcsx-report.tsx', import.meta.url), 'utf8');
  const ppaSource = readFileSync(new URL('../components/ppa-heat-rate-comparison.tsx', import.meta.url), 'utf8');
  const pmisSource = readFileSync(new URL('../components/pmis-report.tsx', import.meta.url), 'utf8');
  const ctktktSource = readFileSync(new URL('../components/ctktkt-report.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(dailySource, /SYNC_UNIFIED/);
  assert.match(dailySource, /type:"SYNC_ALL"/);
  assert.match(dailySource, /SYNC_ALL_RESULT/);
  assert.match(dailySource, /Thời gian sửa chữa\/bảo dưỡng/);
  assert.match(dailySource, /Đồng bộ dữ liệu ngày/);
  assert.match(bcsxSource, /Nhập file lệnh & xuất QLKT/);
  assert.match(ppaSource, /Đồng bộ PPA từ QLKT/);
  assert.match(pmisSource, /Đồng bộ ngày/);
  assert.match(ctktktSource, /Đồng bộ PMIS & 02-PĐ/);

  assert.match(dailySource, /fetch\(`\/api\/ctktkt-report\?period=/);
  assert.match(dailySource, /calculateNh3Summary\(values, null, null\)/);
  assert.match(dailySource, /deriveDailyValuesFromCtktkt/);
  assert.match(dailySource, /Than tồn kho 06h00/);
  assert.match(dailySource, /next\[day\]\.BN = String\(nh3\.usedTonnes\)/);
  assert.match(dailySource, /next\[day\]\.CN = values\.P72/);
  assert.match(dailySource, /disabled=\{isLinked\}/);
  assert.match(ctktktSource, /combined\[CTKTKT_INSTALLED_CAPACITY_CELL\] = CTKTKT_INSTALLED_CAPACITY_MW/);
  assert.match(ctktktSource, /parseLocaleNumber\(entries\[cell\] \|\| ""\)/);
});

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
  const widgetPayload = globalThis.QlktMeterExtractor.extractPpaMeterReadingsFromDataArrays([rows], '2026-09-14', 'http://qlkt/example');
  assert.deepEqual(widgetPayload.readings, payload.readings);
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

test('web app accepts only a complete same-date unified QLKT payload', () => {
  const operatingDate = '2026-09-14';
  const ppa = globalThis.QlktMeterExtractor.extractPpaMeterReadings([[headers, ...meterRows]], operatingDate, 'http://qlkt/example');
  const entry = fieldCode => ({ fieldCode, value: '1', sourceLabel: 'QLKT' });
  const dailyCodes = ['F', 'L', 'AR', 'CC', 'CD', 'CS', 'CT', 'CU', 'CV'];
  const heatRateCodes = ['DA', 'DB', 'DC', 'DD', 'DE', 'DF', 'DG', 'DH'];
  const pmisCodes = ['J157', 'K157', 'J158', 'K158', 'C181', 'D181', 'F181'];
  const payload = {
    version: 1,
    kind: 'unified-sync',
    operatingDate,
    sourcePage: 'QLKT · Đồng bộ tổng hợp',
    daily: { version: 1, operatingDate, sourcePage: 'daily', entries: dailyCodes.map(entry) },
    ppa,
    heatRate: { version: 1, operatingDate, sourcePage: 'heatrate', entries: heatRateCodes.map(entry) },
    events: { version: 1, operatingDate, s1: [], s2: [], totalCount: 0 },
    pmis02Pd: { version: 1, operatingDate, sourcePage: '02-PĐ', entries: pmisCodes.map(entry) },
  };
  assert.ok(validateQlktUnifiedSyncPayload(payload));
  assert.equal(validateQlktUnifiedSyncPayload({ ...payload, operatingDate: '2026-09-15' }), null);
  assert.equal(validateQlktUnifiedSyncPayload({ ...payload, pmis02Pd: { ...payload.pmis02Pd, entries: pmisCodes.slice(1).map(entry) } }), null);
});

test('operating events extractor correctly classifies S1 and S2 events from QLKT format', () => {
  const contentCode = readFileSync(new URL('../public/qlkt-sync-extension/content.js', import.meta.url), 'utf8');
  // Run in a simulated environment to test classifyEventUnit and parseOperatingRow
  const mockGlobal = {};
  class MockMutationObserver { observe() {} disconnect() {} }
  const fn = new Function('globalThis', 'window', 'document', 'location', 'chrome', 'MutationObserver', contentCode);
  fn(mockGlobal, { location: { origin: 'http://test' } }, { querySelectorAll: () => [], documentElement: {} }, { pathname: '', search: '', href: '' }, { runtime: { onMessage: { addListener: () => {} } }, storage: { local: { get: () => {} } } }, MockMutationObserver);

  const classify = mockGlobal.QlktOperatingExtractor.classifyEventUnit;
  const heatRateUnit = mockGlobal.QlktHeatRateExtractor.heatRateUnitFromText;
  assert.equal(heatRateUnit('DH1_MF1'), '1');
  assert.equal(heatRateUnit('DH1-MF2'), '2');
  assert.equal(heatRateUnit('Tổ máy 1'), '1');
  assert.equal(heatRateUnit('Tổ máy 2'), '2');
  assert.equal(heatRateUnit('2'), '2');
  assert.deepEqual(classify('Tăng tải S1 từ 435.7MW lên 470MW'), ['S1']);
  assert.deepEqual(classify('Giảm tải S1 từ 470MW về 435.7MW'), ['S1']);
  assert.deepEqual(classify('Tăng tải S2 từ 435.7MW lên 470MW'), ['S2']);
  assert.deepEqual(classify('Giảm tải S2 từ 470MW về 435.7MW'), ['S2']);
  assert.deepEqual(classify('Khởi động tổ máy S1 hòa lưới'), ['S1']);
  assert.deepEqual(classify('Tách sửa chữa lò MF2'), ['S2']);
  assert.deepEqual(classify('Ngừng khẩn cấp tổ máy 1 do bảo vệ tác động'), ['S1']);
  assert.deepEqual(classify('Cắt điện ĐZ 220kV theo lệnh A0'), ['S1', 'S2']);

  // Test row parsing with mock DOM row
  const parseRow = mockGlobal.QlktOperatingExtractor.parseOperatingRow;
  const mockRow = {
    cells: [
      { querySelectorAll: () => [], querySelector: () => null, textContent: '' }, // checkbox
      { querySelectorAll: () => [], querySelector: () => null, textContent: '17/09/2026' },
      { querySelectorAll: () => [{ value: '17/09/2026 14:33:00' }], querySelector: () => null, textContent: '' },
      { querySelectorAll: () => [{ value: '17/09/2026 14:44:00' }], querySelector: () => null, textContent: '' },
      { querySelectorAll: () => [], querySelector: () => ({ value: '1', options: [{ textContent: '1 - Bình thường: tăng giảm công suất theo lệnh điều độ' }], selectedIndex: 0 }), textContent: '' },
      { querySelectorAll: () => [], querySelector: () => ({ value: 'Tăng tải S1 từ 435.7MW lên 470MW' }), textContent: 'Tăng tải S1 từ 435.7MW lên 470MW' },
    ]
  };
  const parsed = parseRow(mockRow, '2026-09-17');
  assert.ok(parsed);
  assert.equal(parsed.startAt, '2026-09-17 14:33');
  assert.equal(parsed.endAt, '2026-09-17 14:44');
  assert.equal(parsed.eventType, 1);
  assert.equal(parsed.description, 'Tăng tải S1 từ 435.7MW lên 470MW');
});

test('operation page maps generation, standby, incident, maintenance and startup hours to monthly data', () => {
  const contentCode = readFileSync(new URL('../public/qlkt-sync-extension/content.js', import.meta.url), 'utf8');
  const mockGlobal = {};
  class MockMutationObserver { observe() {} disconnect() {} }
  const fn = new Function('globalThis', 'window', 'document', 'location', 'chrome', 'MutationObserver', contentCode);
  fn(mockGlobal, { location: { origin: 'http://test' } }, { querySelectorAll: () => [], documentElement: {} }, { pathname: '', search: '', href: '' }, { runtime: { onMessage: { addListener: () => {} } }, storage: { local: { get: () => {} } } }, MockMutationObserver);

  const makeCell = text => ({ textContent: text, querySelectorAll: () => [] });
  const makeRow = (unit, values) => ({
    textContent: `${unit} 20/09/2026`,
    cells: [makeCell(unit), makeCell('20/09/2026'), ...values.map(value => makeCell(String(value)))],
  });
  const entries = mockGlobal.QlktOperatingExtractor.operationSummaryEntries([
    makeRow('DH1_MF1', [5594.664, 0, 0, 0, 24, 0, 0, 0, 0]),
    makeRow('DH1_MF2', [4915.35, 0, 0, 0, 20, 2, 1, 0.5, 0.5]),
  ]);
  const values = new Map(entries.map(entry => [entry.fieldCode, entry.value]));
  assert.equal(values.get('F'), '24');
  assert.equal(values.get('L'), '20');
  assert.equal(values.get('CS'), '2');
  assert.equal(values.get('CT'), '0.5');
  assert.equal(values.get('CU'), '1.5');
  assert.equal(values.get('CV'), '0');
});
