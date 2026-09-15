const QLKT_PATTERN = /^https?:\/\/qlkt\.tpcduyenhai\.com\.vn\/qlkt\//i;
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
      await wait(300);
    }
  }
  throw lastError || new Error("Không kết nối được với màn hình QLKT.");
}

async function readValuesWithRetry(tabId, attempts = 10) {
  let result;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    result = await sendWithRetry(tabId, { type: "READ_QLKT_VALUES" });
    if (result?.ok) return result;
    await wait(500);
  }
  return result;
}

async function readSource(source, url, operatingDate) {
  let tabId;
  try {
    const tab = await chrome.tabs.create({ url, active: false });
    tabId = tab.id;
    if (!tabId) throw new Error(`Không mở được màn hình ${SOURCE_LABELS[source]}.`);
    await waitForTab(tabId);
    const current = await chrome.tabs.get(tabId);
    if (!QLKT_PATTERN.test(current.url || "")) throw new Error("Phiên đăng nhập QLKT đã hết hạn. Hãy đăng nhập lại rồi thử lại.");
    const prepared = await sendWithRetry(tabId, { type: "PREPARE_QLKT_DATE", operatingDate });
    if (!prepared?.ok) throw new Error(prepared?.error || `Không đặt được ngày tại màn hình ${SOURCE_LABELS[source]}.`);
    await wait(prepared.refreshed ? 2500 : 400);
    const result = await readValuesWithRetry(tabId);
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
    if (tabId) chrome.tabs.remove(tabId).catch(() => {});
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
  const { qlktPages = {} } = await chrome.storage.local.get({ qlktPages: {} });
  if (!qlktPages.meter) throw new Error("Thiếu địa chỉ Công tơ PPA. Chỉ lần đầu, hãy mở màn hình Số liệu đo đếm công tơ rồi mở tiện ích.");
  return readSource("meter", qlktPages.meter, operatingDate);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const task = message?.type === "SYNC_ALL_QLKT" ? syncAll : message?.type === "SYNC_PPA_QLKT" ? syncPpa : null;
  if (!task) return;
  task(message.operatingDate)
    .then(payload => sendResponse({ ok: true, payload }))
    .catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Chưa đồng bộ được dữ liệu." }));
  return true;
});
