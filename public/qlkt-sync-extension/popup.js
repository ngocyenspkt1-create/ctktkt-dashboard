const targetInput = document.getElementById("targetUrl");
const dateInput = document.getElementById("operatingDate");
const syncAllButton = document.getElementById("syncAllButton");
const syncPpaButton = document.getElementById("syncPpaButton");
const syncPageButton = document.getElementById("syncPageButton");
const status = document.getElementById("status");

const sourceIds = {
  production: "source-production",
  fuel: "source-fuel",
  operation: "source-operation",
  meter: "source-meter",
};

function localIsoDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function encodePayload(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function openTarget(target, payload) {
  if (payload?.kind === "ppa-meter") target = new URL("ppa-heat-rate", target);
  target.hash = `qlkt-sync=${encodePayload(payload)}`;
  return chrome.tabs.create({ url: target.toString() });
}

function setBusy(busy) {
  syncAllButton.disabled = busy;
  syncPpaButton.disabled = busy;
  syncPageButton.disabled = busy;
}

async function refreshSources() {
  const { qlktPages = {} } = await chrome.storage.local.get({ qlktPages: {} });
  Object.entries(sourceIds).forEach(([key, id]) => {
    const element = document.getElementById(id);
    const ready = Boolean(qlktPages[key]);
    element.textContent = ready ? "Đã ghi nhớ" : "Chưa nhận diện";
    element.classList.toggle("ready", ready);
  });
}

async function recognizeActivePage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:\/\/qlkt\.tpcduyenhai\.com\.vn\/qlkt\//i.test(tab.url || "")) return;
    const result = await chrome.tabs.sendMessage(tab.id, { type: "GET_QLKT_PAGE_KIND" });
    if (result?.pageKind) {
      await new Promise(resolve => setTimeout(resolve, 100));
      await refreshSources();
    }
  } catch {
    // Trang có thể vừa tải lại; lần mở tiện ích tiếp theo sẽ thử lại.
  }
}

chrome.storage.local.get({ targetUrl: "http://localhost:5173/" }, value => {
  targetInput.value = value.targetUrl;
});
dateInput.value = localIsoDate();
refreshSources();
recognizeActivePage();

syncAllButton.addEventListener("click", async () => {
  status.textContent = "Đang mở các màn hình QLKT và thu thập dữ liệu…";
  setBusy(true);
  try {
    const target = new URL(targetInput.value.trim());
    if (!/^https?:$/.test(target.protocol)) throw new Error("Địa chỉ web chỉ tiêu không hợp lệ.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput.value)) throw new Error("Hãy chọn ngày báo cáo.");
    await chrome.storage.local.set({ targetUrl: target.origin + target.pathname });
    const result = await chrome.runtime.sendMessage({ type: "SYNC_ALL_QLKT", operatingDate: dateInput.value });
    if (!result?.ok) throw new Error(result?.error || "Chưa đồng bộ được toàn bộ dữ liệu.");
    await openTarget(target, result.payload);
    window.close();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Chưa đồng bộ được dữ liệu.";
    setBusy(false);
    refreshSources();
  }
});

syncPpaButton.addEventListener("click", async () => {
  status.textContent = "Đang mở màn hình công tơ và thu thập H1–H48…";
  setBusy(true);
  try {
    const target = new URL(targetInput.value.trim());
    if (!/^https?:$/.test(target.protocol)) throw new Error("Địa chỉ web chỉ tiêu không hợp lệ.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput.value)) throw new Error("Hãy chọn ngày báo cáo.");
    await chrome.storage.local.set({ targetUrl: target.origin + target.pathname });
    const result = await chrome.runtime.sendMessage({ type: "SYNC_PPA_QLKT", operatingDate: dateInput.value });
    if (!result?.ok) throw new Error(result?.error || "Chưa đồng bộ được công tơ PPA.");
    await openTarget(target, result.payload);
    window.close();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Chưa đồng bộ được công tơ PPA.";
    setBusy(false);
    refreshSources();
  }
});

syncPageButton.addEventListener("click", async () => {
  status.textContent = "";
  setBusy(true);
  try {
    const target = new URL(targetInput.value.trim());
    if (!/^https?:$/.test(target.protocol)) throw new Error("Địa chỉ web chỉ tiêu không hợp lệ.");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:\/\/qlkt\.tpcduyenhai\.com\.vn\/qlkt\//i.test(tab.url || "")) throw new Error("Hãy mở một màn hình QLKT trước khi đồng bộ.");
    const prepared = await chrome.tabs.sendMessage(tab.id, { type: "PREPARE_QLKT_DATE", operatingDate: dateInput.value });
    if (!prepared?.ok) throw new Error(prepared?.error || "Không đặt được ngày báo cáo.");
    await new Promise(resolve => setTimeout(resolve, prepared.refreshed ? 2200 : 300));
    const result = await chrome.tabs.sendMessage(tab.id, { type: "READ_QLKT_VALUES" });
    if (!result?.ok) throw new Error(result?.error || "Không tìm thấy chỉ tiêu được cấu hình trên màn hình này.");
    await chrome.storage.local.set({ targetUrl: target.origin + target.pathname });
    await openTarget(target, result.payload);
    window.close();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Chưa đồng bộ được dữ liệu.";
    setBusy(false);
  }
});
