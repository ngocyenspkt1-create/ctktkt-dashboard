importScripts("meter-extract.js");

const QLKT_PATTERN = /^https?:\/\/qlkt\.tpcduyenhai\.com\.vn\/qlkt\//i;
// Địa chỉ cố định của màn hình "Số liệu đo đếm công tơ" — dùng làm mặc định
// để tiện ích luôn mở đúng thẳng vào đây, không phụ thuộc việc "ghi nhớ"
// trang trước đó có đúng/còn hiệu lực hay không.
const DEFAULT_METER_URL = "http://qlkt.tpcduyenhai.com.vn/qlkt/sxd/solieucto.jsf";
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

async function readValuesWithRetry(tabId, attempts = 10, intervalMs = 500) {
  let result;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    result = await sendWithRetry(tabId, { type: "READ_QLKT_VALUES" });
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
      return { arrays, widgetNames: Object.keys(widgets), hasPrimeFaces: Boolean(globalThis.PrimeFaces) };
    },
  });
  const snapshot = executions?.[0]?.result;
  if (!snapshot?.arrays?.length) {
    return { ok: false, error: `Không đọc được mảng dữ liệu từ widget QLKT. (PrimeFaces: ${snapshot?.hasPrimeFaces ? "có" : "không"}; widgets: ${(snapshot?.widgetNames || []).join(", ") || "không có"}.)` };
  }
  try {
    const payload = globalThis.QlktMeterExtractor.extractPpaMeterReadingsFromDataArrays(snapshot.arrays, operatingDate, sourcePage);
    return { ok: true, payload };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Không đọc được dữ liệu widget công tơ QLKT." };
  }
}

async function readSource(source, url, operatingDate) {
  let tabId;
  let createdTab = false;
  const isMeter = source === "meter";
  // Màn hình Công tơ PPA chỉ thực sự nạp bảng dữ liệu (ExtSheet) khi tab đang
  // ở trạng thái hiển thị — QLKT có vẻ trì hoãn dựng bảng nặng này nếu tab
  // chạy nền (active:false), nên với nguồn "meter" phải mở tab ở chế độ đang
  // xem, rồi tự quay lại tab làm việc của người dùng sau khi lấy xong dữ liệu.
  let previousActiveTabId;
  let previousActiveWindowId;
  try {
    if (isMeter) {
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
      tab = await chrome.tabs.create({ url, active: isMeter });
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
      result = await readMeterFromPageWorld(tabId, operatingDate, current.url || url);
      if (!result?.ok) {
        const pageWorldError = result?.error || "Không đọc được widget QLKT.";
        result = await readValuesWithRetry(tabId, 40, 700);
        if (!result?.ok) result = { ...result, error: `${result?.error || "Không đọc được màn hình Công tơ PPA."} [Đọc trực tiếp widget: ${pageWorldError}]` };
      }
    } else result = await readValuesWithRetry(tabId);
    if (!result?.ok) throw new Error(result?.error || `Không đọc được màn hình ${SOURCE_LABELS[source]}.`);
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
  const missing = DAILY_SOURCES.filter(key => !qlktPages[key]);
  if (missing.length) {
    const labels = missing.map(key => SOURCE_LABELS[key]).join(", ");
    throw new Error(`Thiếu địa chỉ: ${labels}. Chỉ lần đầu, hãy mở từng màn hình này một lần rồi thử lại.`);
  }
  const payloads = [];
  for (const source of DAILY_SOURCES) {
    payloads.push(await readSource(source, qlktPages[source], operatingDate));
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
