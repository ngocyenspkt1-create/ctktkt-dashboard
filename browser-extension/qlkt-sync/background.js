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
};
const DAILY_SOURCES = ["production", "fuel", "operation"];
const REQUIRED_FIELDS = {
  production: ["B", "C", "H", "I"],
  fuel: ["X", "AE", "AF", "AJ", "AR", "AT", "CC", "CD"],
  operation: ["F", "L"],
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
    const prepared = await sendWithRetry(tabId, { type: "PREPARE_QLKT_DATE", operatingDate });
    if (!prepared?.ok) throw new Error(prepared?.error || `Không đặt được ngày tại màn hình ${SOURCE_LABELS[source]}.`);
    // Màn hình Công tơ PPA (bảng ExtSheet 4 điểm đo × 48 chu kỳ) thường mất
    // nhiều thời gian hơn để máy chủ QLKT nạp xong dữ liệu so với các màn
    // hình khác, kể cả sau khi trình duyệt báo trang đã "tải xong". Vì vậy
    // cho nguồn "meter" một khoảng chờ và số lần thử lại nhiều hơn hẳn.
    await wait(isMeter ? (prepared.refreshed ? 4000 : 1500) : (prepared.refreshed ? 2500 : 400));
    const result = isMeter ? await readValuesWithRetry(tabId, 40, 700) : await readValuesWithRetry(tabId);
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const task = message?.type === "SYNC_ALL_QLKT" ? syncAll : message?.type === "SYNC_PPA_QLKT" ? syncPpa : null;
  if (!task) return;
  task(message.operatingDate)
    .then(payload => sendResponse({ ok: true, payload }))
    .catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Chưa đồng bộ được dữ liệu." }));
  return true;
});
