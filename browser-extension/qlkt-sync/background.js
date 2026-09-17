importScripts("meter-extract.js");

const QLKT_PATTERN = /^https?:\/\/qlkt\.tpcduyenhai\.com\.vn\/qlkt\//i;
// Địa chỉ cố định của màn hình "Số liệu đo đếm công tơ" — dùng làm mặc định
// để tiện ích luôn mở đúng thẳng vào đây, không phụ thuộc việc "ghi nhớ"
// trang trước đó có đúng/còn hiệu lực hay không.
const DEFAULT_METER_URL = "http://qlkt.tpcduyenhai.com.vn/qlkt/sxd/solieucto.jsf";
// Tương tự, màn hình "Sản lượng" (Vận hành → Sản lượng) từng bị ghi nhớ NHẦM
// địa chỉ của báo cáo khác cùng module ("Cập nhật sản lượng bù trừ",
// rpt_a_bu_tru_day.jsf — xem content.js/pageKind) vì 2 trang có nội dung giống
// nhau, khiến đồng bộ luôn đọc ra 0 chỉ tiêu mà người dùng không biết vì sao.
// Cố định luôn địa chỉ đúng (đã xác nhận trực tiếp trên hệ thống QLKT thật)
// thay vì phụ thuộc "ghi nhớ", để lỗi này không thể tái diễn.
const DEFAULT_PRODUCTION_URL = "http://qlkt.tpcduyenhai.com.vn/qlkt/sxd/rpt_a_production_day.jsf";
const SOURCE_LABELS = {
  production: "Sản lượng",
  fuel: "Nhiên liệu",
  operation: "Vận hành",
  meter: "Công tơ PPA",
  heatrate: "Cân bằng nhiệt",
};
const DAILY_SOURCES = ["production", "fuel", "operation"];
const REQUIRED_FIELDS = {
  production: ["B", "C", "H", "I"],
  fuel: ["X", "AE", "AF", "AJ", "AR", "AT", "CC", "CD"],
  operation: ["F", "L"],
  // 8 mã của cả 2 tổ máy (S1+S2) — content.js tự đổi "Tổ máy" trên màn hình Cân bằng nhiệt và đọc
  // lần lượt cả 2 trong 1 lần gọi READ_QLKT_VALUES, nên chỉ cần 1 tab, không cần mở 2 lần như trước.
  heatrate: ["DA", "DB", "DC", "DD", "DE", "DF", "DG", "DH"],
};

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function waitForTab(tabId, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("QLKT tải trang quá lâu."));
    }, timeout);
    const listener = (updatedId, changeInfo) => {
      if (updatedId === tabId && changeInfo.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then(tab => {
      if (tab.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }).catch(error => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      reject(error);
    });
  });
}

async function sendWithRetry(tabId, message, attempts = 10) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        try {
          await chrome.scripting.executeScript({ target: { tabId }, files: ["meter-extract.js", "content.js"] });
        } catch (injectionError) {
          lastError = injectionError;
        }
      }
      await wait(300);
    }
  }
  throw lastError || new Error("Không kết nối được với màn hình QLKT.");
}

async function readValuesWithRetry(tabId, operatingDate, attempts = 10, intervalMs = 500) {
  let result;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    result = await sendWithRetry(tabId, { type: "READ_QLKT_VALUES", operatingDate });
    if (result?.ok) return result;
    await wait(intervalMs);
  }
  return result;
}

async function prepareDateWithRetry(tabId, operatingDate, attempts = 20, intervalMs = 500) {
  let result;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    result = await sendWithRetry(tabId, { type: "PREPARE_QLKT_DATE", operatingDate });
    if (result?.ok || !result?.retryable) return result;
    await wait(intervalMs);
  }
  return result;
}

async function readMeterFromPageWorld(tabId, operatingDate, sourcePage) {
  const executions = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: () => {
      const arrays = [], seenObjects = new WeakSet(), seenArrays = new Set();
      const collect = (value, depth) => {
        if (!value || depth < 0 || (typeof value !== "object" && !Array.isArray(value))) return;
        if (typeof Node !== "undefined" && value instanceof Node) return;
        if (typeof Window !== "undefined" && value instanceof Window) return;
        if (Array.isArray(value)) {
          if (value.some(row => Array.isArray(row) && row.length >= 53)) {
            let signature;
            try { signature = JSON.stringify(value); } catch { return; }
            if (!seenArrays.has(signature)) { seenArrays.add(signature); arrays.push(value); }
            return;
          }
          if (depth > 0) value.slice(0, 100).forEach(item => collect(item, depth - 1));
          return;
        }
        if (seenObjects.has(value)) return;
        seenObjects.add(value);
        if (depth === 0) return;
        let keys = [];
        try { keys = Object.keys(value).slice(0, 200); } catch { return; }
        for (const key of keys) {
          try { collect(value[key], depth - 1); } catch { /* ignore page getters */ }
        }
      };
      const widgets = globalThis.PrimeFaces?.widgets || {};
      collect(widgets, 4);
      for (const name of ["sheetWidget", "widget_sheetWidget"]) {
        try { collect(typeof globalThis.PF === "function" ? globalThis.PF(name) : null, 4); } catch { /* widget not found */ }
        try { collect(globalThis[name], 4); } catch { /* global not found */ }
      }
      // Chẩn đoán thêm: ô ngày đang HIỂN THỊ trên trang lúc đọc — để phân biệt
      // 2 tình huống khác nhau khi dữ liệu vẫn sai ngày: (a) ô ngày đã đúng
      // nhưng bảng dữ liệu thật sự chưa nạp kịp (chỉ cần chờ thêm), hay (b) ô
      // ngày chưa từng đổi/đã bị trả lại giá trị cũ (nút cập nhật bấm sai chỗ,
      // cần dò lại cách bấm nút).
      const visibleDates = [...document.querySelectorAll("input")]
        .map(input => String(input.value || input.getAttribute("value") || "").trim())
        .filter(value => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value));
      return { arrays, widgetNames: Object.keys(widgets), hasPrimeFaces: Boolean(globalThis.PrimeFaces), visibleDates: [...new Set(visibleDates)] };
    },
  });
  const snapshot = executions?.[0]?.result;
  const dateInfo = `Ô ngày trên trang: ${(snapshot?.visibleDates || []).join(", ") || "không thấy"}.`;
  if (!snapshot?.arrays?.length) {
    return { ok: false, error: `Không đọc được mảng dữ liệu từ widget QLKT. (PrimeFaces: ${snapshot?.hasPrimeFaces ? "có" : "không"}; widgets: ${(snapshot?.widgetNames || []).join(", ") || "không có"}. ${dateInfo})` };
  }
  try {
    const payload = globalThis.QlktMeterExtractor.extractPpaMeterReadingsFromDataArrays(snapshot.arrays, operatingDate, sourcePage);
    return { ok: true, payload };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được dữ liệu widget công tơ QLKT.";
    return { ok: false, error: `${message} (${dateInfo})` };
  }
}

// Sau khi bấm nút "làm mới" để đổi ngày, QLKT nạp lại dữ liệu ExtSheet bằng
// AJAX ở phía máy chủ — có thể mất vài giây, và trong lúc đó widget vẫn còn
// giữ nguyên dữ liệu CỦA NGÀY CŨ trong bộ nhớ (nên đọc thử sẽ ra đúng cấu
// trúc nhưng sai ngày). Đọc 1 lần rồi bỏ cuộc ngay khi thấy sai ngày là
// nguyên nhân khiến việc đồng bộ báo lỗi dù chỉ cần chờ thêm; vì vậy phải
// thử lại nhiều lần giống hệt cách readValuesWithRetry() làm cho các màn
// hình khác, cho tới khi widget thực sự nạp xong đúng ngày đã chọn.
// Giới hạn theo THỜI GIAN THỰC (deadline) thay vì đếm số lần thử: mỗi lần đọc
// tự nó cũng tốn thời gian (executeScript + JSON.stringify để dò trùng lặp
// trên bảng có thể khá lớn), nên đếm số lần thử cố định có thể khiến tổng
// thời gian vượt quá dự tính nếu máy chủ QLKT chậm bất thường — trong khi web
// Chỉ tiêu KTKT chỉ chờ tối đa một khoảng thời gian cố định trước khi tự báo
// "QLKT phản hồi quá lâu" (xem components/ppa-heat-rate-comparison.tsx).
async function readMeterFromPageWorldWithRetry(tabId, operatingDate, sourcePage, timeoutMs = 35000, intervalMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  let result;
  do {
    result = await readMeterFromPageWorld(tabId, operatingDate, sourcePage);
    if (result?.ok) return result;
    await wait(intervalMs);
  } while (Date.now() < deadline);
  return result;
}

async function readSource(source, url, operatingDate) {
  let tabId;
  let createdTab = false;
  const isMeter = source === "meter";
  // Các màn hình QLKT (không riêng Công tơ PPA) chỉ thực sự dựng bảng dữ liệu
  // đầy đủ khi tab đang ở trạng thái hiển thị — QLKT có vẻ trì hoãn/bỏ qua
  // việc render các bảng nặng nếu tab chạy nền (active:false). Ban đầu chỉ
  // phát hiện và sửa cho "meter", nhưng lỗi tương tự (0 chỉ tiêu đọc được) cũng
  // xảy ra ở "production" — nên áp dụng active:true cho TẤT CẢ nguồn, không
  // chỉ riêng meter, rồi tự quay lại tab làm việc của người dùng sau khi xong.
  let previousActiveTabId;
  let previousActiveWindowId;
  try {
    {
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      previousActiveTabId = currentTab?.id;
      previousActiveWindowId = currentTab?.windowId;
    }
    let tab;
    if (isMeter) {
      const openTabs = await chrome.tabs.query({});
      const existingMeterTab = openTabs.find(candidate => {
        try {
          const parsed = new URL(candidate.url || "");
          return QLKT_PATTERN.test(candidate.url || "") && parsed.pathname.toLowerCase().endsWith("/sxd/solieucto.jsf");
        } catch {
          return false;
        }
      });
      if (existingMeterTab?.id) {
        tab = await chrome.tabs.update(existingMeterTab.id, { active: true });
        if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
      }
    }
    if (!tab) {
      tab = await chrome.tabs.create({ url, active: true });
      createdTab = true;
    }
    tabId = tab.id;
    if (!tabId) throw new Error(`Không mở được màn hình ${SOURCE_LABELS[source]}.`);
    await waitForTab(tabId);
    const current = await chrome.tabs.get(tabId);
    if (!QLKT_PATTERN.test(current.url || "")) throw new Error("Phiên đăng nhập QLKT đã hết hạn. Hãy đăng nhập lại rồi thử lại.");
    const prepared = await prepareDateWithRetry(tabId, operatingDate);
    if (!prepared?.ok) throw new Error(prepared?.error || `Không đặt được ngày tại màn hình ${SOURCE_LABELS[source]}.`);
    // Màn hình Công tơ PPA (bảng ExtSheet 4 điểm đo × 48 chu kỳ) thường mất
    // nhiều thời gian hơn để máy chủ QLKT nạp xong dữ liệu so với các màn
    // hình khác, kể cả sau khi trình duyệt báo trang đã "tải xong". Vì vậy
    // cho nguồn "meter" một khoảng chờ và số lần thử lại nhiều hơn hẳn.
    await wait(isMeter ? (prepared.refreshed ? 4000 : 1500) : (prepared.refreshed ? 2500 : 400));
    let result;
    if (isMeter) {
      result = await readMeterFromPageWorldWithRetry(tabId, operatingDate, current.url || url);
      if (!result?.ok) {
        const pageWorldError = result?.error || "Không đọc được widget QLKT.";
        // Cách đọc dự phòng (dò thẻ <script> tĩnh) hầu như không còn tác dụng
        // trên QLKT hiện tại (dữ liệu ExtSheet luôn nạp bằng AJAX, không nhúng
        // sẵn trong HTML) nên chỉ thử vài lần cho chắc thay vì chờ lâu vô ích.
        result = await readValuesWithRetry(tabId, operatingDate, 5, 500);
        if (!result?.ok) {
          const prepInfo = `Đã bấm nút cập nhật ngày: ${prepared.refreshed ? `có (${prepared.controlInfo || "?"})` : "không (ngày đã đúng sẵn khi kiểm tra)"}.`;
          result = { ...result, error: `${result?.error || "Không đọc được màn hình Công tơ PPA."} [Đọc trực tiếp widget: ${pageWorldError}] [${prepInfo}]` };
        }
      }
    } else result = await readValuesWithRetry(tabId, operatingDate);
    if (!result?.ok) throw new Error(`Màn hình ${SOURCE_LABELS[source]}: ${result?.error || "không đọc được dữ liệu."}`);
    if (source === "meter") {
      if (result.payload?.kind !== "ppa-meter" || result.payload?.readings?.length !== 4) {
        throw new Error("Màn hình Công tơ PPA chưa đọc đủ 4 điểm đo bắt buộc.");
      }
    } else {
      const received = new Set((result.payload?.entries || []).map(entry => entry.fieldCode));
      const missingFields = REQUIRED_FIELDS[source].filter(fieldCode => !received.has(fieldCode));
      if (missingFields.length) {
        throw new Error(`Màn hình ${SOURCE_LABELS[source]} còn thiếu ${missingFields.length} chỉ tiêu. Tiện ích đã dừng để tránh đồng bộ thiếu dữ liệu.`);
      }
    }
    if (result.payload?.operatingDate !== operatingDate) {
      throw new Error(`Màn hình ${SOURCE_LABELS[source]} chưa chuyển sang đúng ngày đã chọn.`);
    }
    return result.payload;
  } finally {
    if (tabId && createdTab) chrome.tabs.remove(tabId).catch(() => {});
    if (previousActiveTabId) chrome.tabs.update(previousActiveTabId, { active: true }).catch(() => {});
    if (previousActiveWindowId) chrome.windows.update(previousActiveWindowId, { focused: true }).catch(() => {});
  }
}

async function syncAll(operatingDate) {
  const { qlktPages = {} } = await chrome.storage.local.get({ qlktPages: {} });
  const urlFor = source => source === "production" ? DEFAULT_PRODUCTION_URL : qlktPages[source];
  const missing = DAILY_SOURCES.filter(key => !urlFor(key));
  if (missing.length) {
    const labels = missing.map(key => SOURCE_LABELS[key]).join(", ");
    throw new Error(`Thiếu địa chỉ: ${labels}. Chỉ lần đầu, hãy mở từng màn hình này một lần rồi thử lại.`);
  }
  const payloads = [];
  for (const source of DAILY_SOURCES) {
    payloads.push(await readSource(source, urlFor(source), operatingDate));
  }
  const entries = new Map();
  payloads.flatMap(payload => payload.entries || []).forEach(entry => entries.set(entry.fieldCode, entry));
  if (!entries.size) throw new Error("Không tìm thấy dữ liệu nào để đồng bộ.");
  return {
    version: 1,
    operatingDate,
    sourcePage: "QLKT · Đồng bộ tất cả",
    entries: [...entries.values()],
  };
}

async function syncPpa(operatingDate) {
  // Luôn mở thẳng địa chỉ cố định của màn hình công tơ, không dùng địa chỉ đã
  // "ghi nhớ" trước đó nữa — địa chỉ ghi nhớ có thể sai hoặc trỏ tới một biến
  // thể khác của trang, gây mất thời gian dò mà không ra dữ liệu.
  return readSource("meter", DEFAULT_METER_URL, operatingDate);
}

async function syncHeatRate(operatingDate) {
  const { qlktPages = {} } = await chrome.storage.local.get({ qlktPages: {} });
  if (!qlktPages.heatrate) {
    throw new Error("Chưa ghi nhớ địa chỉ màn hình Cân bằng nhiệt. Hãy mở màn hình đó trên QLKT một lần rồi thử lại.");
  }
  // content.js tự đổi dropdown "Tổ máy" trên màn hình Cân bằng nhiệt và đọc lần lượt cả S1 + S2
  // trong 1 lần gọi READ_QLKT_VALUES, nên chỉ cần đọc 1 nguồn "heatrate" duy nhất — không cần mở
  // hoặc chọn lại tổ máy thủ công như trước.
  return readSource("heatrate", qlktPages.heatrate, operatingDate);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const task = message?.type === "SYNC_ALL_QLKT" ? syncAll
    : message?.type === "SYNC_PPA_QLKT" ? syncPpa
    : message?.type === "SYNC_HEATRATE_QLKT" ? syncHeatRate
    : null;
  if (!task) return;
  task(message.operatingDate)
    .then(payload => sendResponse({ ok: true, payload }))
    .catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Chưa đồng bộ được dữ liệu." }));
  return true;
});
