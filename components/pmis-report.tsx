"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AxisDomainItem } from "recharts/types/util/types";
import { DateField } from "@/components/ui/date-field";
import { decodeQlktSyncHash, qlktFieldLabels, roundQlktValue, validateQlktSyncPayload, type QlktSyncPayload } from "@/lib/qlkt-sync";

type DailyInput = { operatingDate: string; fieldCode: string; value: string };
type Unit = "s1" | "s2";

// 5 chỉ tiêu của báo cáo "THEO PMIS" lấy từ QLKT, tách theo tổ máy S1/S2. 4 chỉ tiêu đầu là số liệu
// mới (đồng bộ trực tiếp từ màn hình "Tính toán hiệu suất lò/suất hao nhiệt" của QLKT, lưu vào các
// mã DA–DH trong kho dữ liệu chung); riêng "Suất tiêu hao NH3 đầu cực" không cần mã riêng vì đã có
// sẵn công thức BT (S1 = NH3 DCS S1 / Đầu cực S1) và BV (S2 = NH3 DCS S2 / Đầu cực S2) trong "Chỉ
// tiêu phụ" — chỉ cần lấy lại đúng công thức đó từ B, H, BQ, BR.
const METRICS: { key: string; label: string; unit: string; codes?: Record<Unit, string> }[] = [
  { key: "PG", label: "Trung bình công suất đầu cực", unit: "MW", codes: { s1: "DA", s2: "DB" } },
  { key: "L1", label: "Tổn thất khói khô trung bình", unit: "%", codes: { s1: "DC", s2: "DD" } },
  { key: "PBN", label: "Trung bình chân không bình ngưng", unit: "kPa", codes: { s1: "DE", s2: "DF" } },
  { key: "TNM", label: "Trung bình nhiệt độ nước làm mát tuần hoàn", unit: "°C", codes: { s1: "DG", s2: "DH" } },
  { key: "NH3", label: "Suất tiêu hao NH3 đầu cực MF", unit: "g/kWh" },
];
// Màu cố định theo thứ tự cho từng chỉ tiêu (không đổi theo bộ lọc) — dùng khi gộp cả 5 chỉ tiêu
// vào chung 1 biểu đồ nên cần phân biệt bằng màu thay vì bằng tổ máy.
const METRIC_COLOR: Record<string, string> = { PG: "#dc2626", L1: "#c2410c", PBN: "#15803d", TNM: "#0d9488", NH3: "#7e22ce" };

const UNIT_LABEL: Record<Unit, string> = { s1: "S1-DH1", s2: "S2-DH1" };
// Cùng 1 cặp màu tổ máy đã dùng ở trang So sánh SHN PPA (xanh dương = S1, hổ phách = S2) để người
// dùng nhận ra "tổ máy nào là màu nào" nhất quán giữa các trang, không phải học lại bảng màu mới.
const UNIT_COLOR: Record<Unit, string> = { s1: "#2f6fb0", s2: "#b9860f" };
// Cột nhãn chỉ tiêu đứng yên bên trái (sticky) khi cuộn ngang; độ rộng cố định để tính minWidth của
// bảng (LABEL_COL_PX) khớp với LABEL_COL.
const LABEL_COL = "w-[150px] min-w-[150px]";
const LABEL_COL_PX = 150;
const HEADER_ROW_H = "h-7";
const BAND_ROW_H = "h-6";
const METRIC_ROW_H = "h-8";

const localToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const numberFormat = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const format = (value: number | null) => value === null || !Number.isFinite(value) ? "—" : numberFormat.format(value);
const numberValue = (value?: string) => { if (!value?.trim()) return null; const n = Number(value.replace(",", ".")); return Number.isFinite(n) ? n : null; };
const safeDivide = (a: number | null, b: number | null) => a === null || b === null || b === 0 ? null : a / b;
const ddMM = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const formatInputValue = (value?: string) => { const parsed = numberValue(value); return parsed === null ? (value || "") : format(parsed); };

function addDaysIso(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function datesBetween(from: string, to: string) {
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to && dates.length <= 62) { dates.push(cursor); cursor = addDaysIso(cursor, 1); }
  return dates;
}

function periodsBetween(from: string, to: string) {
  const periods: string[] = [];
  let [year, month] = [Number(from.slice(0, 4)), Number(from.slice(5, 7))];
  const endYear = Number(to.slice(0, 4)), endMonth = Number(to.slice(5, 7));
  while (year < endYear || (year === endYear && month <= endMonth)) {
    periods.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1; if (month > 12) { month = 1; year += 1; }
    if (periods.length > 24) break;
  }
  return periods;
}

export function PmisReport() {
  const today = useMemo(() => localToday(), []);
  const [fromDate, setFromDate] = useState(() => addDaysIso(localToday(), -9));
  const [toDate, setToDate] = useState(today);
  const [dailyInputs, setDailyInputs] = useState<DailyInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [syncHelp, setSyncHelp] = useState(false);
  const [pendingSync, setPendingSync] = useState<QlktSyncPayload | null>(null);
  const [selectedSyncCodes, setSelectedSyncCodes] = useState<Set<string>>(new Set());
  const [syncDate, setSyncDate] = useState(() => addDaysIso(localToday(), -1));
  const [extensionVersion, setExtensionVersion] = useState("");
  const [syncingQlkt, setSyncingQlkt] = useState(false);
  const [savingSync, setSavingSync] = useState(false);
  const qlktRequestRef = useRef<{ id: string; timer: number } | null>(null);
  // Đồng bộ nhiều ngày liên tiếp (ví dụ lấy lại dữ liệu tháng trước): lặp qua từng ngày trong
  // khoảng đã chọn, gọi lại đúng luồng "1 ngày · 2 tổ máy" ở trên cho mỗi ngày rồi tự lưu luôn (không
  // hiện hộp thoại xác nhận cho từng ngày, vì có thể tới vài chục ngày).
  const [syncRangeFrom, setSyncRangeFrom] = useState(() => addDaysIso(localToday(), -9));
  const [syncRangeTo, setSyncRangeTo] = useState(() => addDaysIso(localToday(), -1));
  const [syncingRange, setSyncingRange] = useState(false);
  const [rangeProgress, setRangeProgress] = useState("");
  // Khoảng ngày riêng cho biểu đồ, độc lập với khoảng ngày của bảng — mặc định trùng bảng, người
  // dùng có thể đổi để xem xu hướng dài/ngắn hơn mà không phải đổi cả bảng.
  const [chartFromDate, setChartFromDate] = useState(() => addDaysIso(localToday(), -9));
  const [chartToDate, setChartToDate] = useState(today);
  const cancelRangeRef = useRef(false);

  // Không cắt kết quả về đúng [from,to] nữa — giữ nguyên toàn bộ dữ liệu của các tháng đã tải, vì
  // bảng và biểu đồ có thể đang xem 2 khoảng ngày khác nhau cùng lúc (xem reloadForBothRanges bên
  // dưới); mỗi nơi tự lọc theo đúng danh sách ngày của mình khi hiển thị (valueFor chỉ được gọi cho
  // các ngày trong "dates"/"chartDates"), nên giữ dư dữ liệu ở đây không ảnh hưởng gì.
  async function loadRange(from: string, to: string) {
    setLoading(true); setError("");
    try {
      const periods = periodsBetween(from, to);
      const responses = await Promise.all(periods.map(period => fetch(`/api/daily-inputs?period=${period}`, { cache: "no-store" }).then(response => response.json() as Promise<{ entries?: DailyInput[]; error?: string }>)));
      const all = responses.flatMap(body => body.entries || []);
      setDailyInputs(all);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không tải được dữ liệu."); }
    finally { setLoading(false); }
  }

  // Luôn tải đủ tháng cho CẢ khoảng ngày của bảng lẫn của biểu đồ (gộp lại), để đổi riêng 1 trong 2
  // khoảng không làm mất dữ liệu của khoảng còn lại.
  function reloadForBothRanges() {
    const from = fromDate < chartFromDate ? fromDate : chartFromDate;
    const to = toDate > chartToDate ? toDate : chartToDate;
    return loadRange(from, to);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void reloadForBothRanges(); }, []);

  function applyManualRange() { void reloadForBothRanges(); }
  function applyChartRange() { void reloadForBothRanges(); }

  useEffect(() => {
    const payload = decodeQlktSyncHash(window.location.hash);
    if (!payload) return;
    setPendingSync(payload);
    setSelectedSyncCodes(new Set(payload.entries.map(entry => entry.fieldCode)));
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, []);

  useEffect(() => {
    const channel = "ctktkt-qlkt-sync";
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data as { channel?: string; sender?: string; type?: string; version?: string; requestId?: string; result?: { ok?: boolean; payload?: unknown; error?: string } };
      if (!data || data.channel !== channel || data.sender !== "ctktkt-extension") return;
      if (data.type === "READY") { setExtensionVersion(String(data.version || "đã kết nối")); return; }
      if (data.type !== "SYNC_HEATRATE_RESULT" || !qlktRequestRef.current || data.requestId !== qlktRequestRef.current.id) return;
      window.clearTimeout(qlktRequestRef.current.timer); qlktRequestRef.current = null; setSyncingQlkt(false);
      if (!data.result?.ok) { setError(data.result?.error || "Chưa đồng bộ được dữ liệu từ QLKT."); return; }
      const payload = validateQlktSyncPayload(data.result.payload);
      if (!payload) { setError("Dữ liệu tiện ích trả về không có chỉ tiêu nào của báo cáo này."); return; }
      setPendingSync(payload); setSelectedSyncCodes(new Set(payload.entries.map(entry => entry.fieldCode))); setError("");
    };
    window.addEventListener("message", handleMessage);
    window.postMessage({ channel, sender: "ctktkt-web", type: "PING" }, window.location.origin);
    return () => { window.removeEventListener("message", handleMessage); if (qlktRequestRef.current) window.clearTimeout(qlktRequestRef.current.timer); };
  }, []);

  function syncFromQlkt() {
    setError(""); setMessage("");
    if (!extensionVersion) { window.postMessage({ channel: "ctktkt-qlkt-sync", sender: "ctktkt-web", type: "PING" }, window.location.origin); setSyncHelp(true); setError("Web chưa kết nối với tiện ích QLKT. Hãy Reload tiện ích rồi nhấn F5 trang này."); return; }
    if (qlktRequestRef.current) window.clearTimeout(qlktRequestRef.current.timer);
    const requestId = crypto.randomUUID();
    // Đồng bộ Cân bằng nhiệt giờ đọc lần lượt cả 2 Tổ máy (tự chuyển dropdown + chờ AJAX nạp lại)
    // trong 1 lần gọi, nên cho thời gian chờ tối đa dài hơn so với đọc 1 tổ máy trước đây.
    const timer = window.setTimeout(() => { if (qlktRequestRef.current?.id !== requestId) return; qlktRequestRef.current = null; setSyncingQlkt(false); setError("QLKT phản hồi quá lâu. Hãy kiểm tra phiên đăng nhập QLKT rồi thử lại."); }, 120000);
    qlktRequestRef.current = { id: requestId, timer }; setSyncingQlkt(true);
    window.postMessage({ channel: "ctktkt-qlkt-sync", sender: "ctktkt-web", type: "SYNC_HEATRATE", requestId, operatingDate: syncDate }, window.location.origin);
  }

  // Dùng riêng cho đồng bộ nhiều ngày: gửi 1 yêu cầu SYNC_HEATRATE cho đúng 1 ngày và chờ kết quả
  // bằng Promise, độc lập với luồng qlktRequestRef/pendingSync của nút "Đồng bộ QLKT" 1 ngày ở trên
  // (mỗi yêu cầu có requestId riêng nên không đụng nhau khi cả 2 luồng cùng lắng nghe "message").
  function requestHeatRateSync(operatingDate: string, timeoutMs = 120000) {
    return new Promise<{ ok: boolean; payload?: unknown; error?: string }>(resolve => {
      const channel = "ctktkt-qlkt-sync";
      const requestId = crypto.randomUUID();
      let settled = false;
      const finish = (result: { ok: boolean; payload?: unknown; error?: string }) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        window.removeEventListener("message", handleMessage);
        resolve(result);
      };
      const handleMessage = (event: MessageEvent) => {
        if (event.source !== window || event.origin !== window.location.origin) return;
        const data = event.data as { channel?: string; sender?: string; type?: string; requestId?: string; result?: { ok?: boolean; payload?: unknown; error?: string } };
        if (!data || data.channel !== channel || data.sender !== "ctktkt-extension" || data.type !== "SYNC_HEATRATE_RESULT" || data.requestId !== requestId) return;
        finish(data.result?.ok ? { ok: true, payload: data.result.payload } : { ok: false, error: data.result?.error || "Chưa đồng bộ được dữ liệu từ QLKT." });
      };
      const timer = window.setTimeout(() => finish({ ok: false, error: "QLKT phản hồi quá lâu." }), timeoutMs);
      window.addEventListener("message", handleMessage);
      window.postMessage({ channel, sender: "ctktkt-web", type: "SYNC_HEATRATE", requestId, operatingDate }, window.location.origin);
    });
  }

  function cancelRangeSync() { cancelRangeRef.current = true; setRangeProgress("Đang dừng…"); }

  async function syncRangeFromQlkt() {
    setError(""); setMessage("");
    if (!extensionVersion) { window.postMessage({ channel: "ctktkt-qlkt-sync", sender: "ctktkt-web", type: "PING" }, window.location.origin); setSyncHelp(true); setError("Web chưa kết nối với tiện ích QLKT. Hãy Reload tiện ích rồi nhấn F5 trang này."); return; }
    if (syncRangeFrom > syncRangeTo) { setError("Khoảng ngày đồng bộ không hợp lệ."); return; }
    const dateList = datesBetween(syncRangeFrom, syncRangeTo);
    if (!dateList.length) { setError("Khoảng ngày đồng bộ không hợp lệ."); return; }
    if (dateList.length > 62) { setError("Mỗi lần chỉ đồng bộ tối đa 62 ngày — hãy chia nhỏ khoảng ngày."); return; }
    cancelRangeRef.current = false;
    setSyncingRange(true);
    const saved: string[] = [];
    const failed: { date: string; error: string }[] = [];
    for (let index = 0; index < dateList.length; index += 1) {
      if (cancelRangeRef.current) break;
      const date = dateList[index];
      setRangeProgress(`Đang đồng bộ ${index + 1}/${dateList.length} — ngày ${date.split("-").reverse().join("/")}…`);
      const result = await requestHeatRateSync(date);
      if (!result.ok) { failed.push({ date, error: result.error || "Lỗi không rõ." }); continue; }
      const payload = validateQlktSyncPayload(result.payload);
      if (!payload || !payload.entries.length) { failed.push({ date, error: "Không có chỉ tiêu nào." }); continue; }
      try {
        const period = payload.operatingDate.slice(0, 7);
        const entries = payload.entries.map(entry => ({ operatingDate: payload.operatingDate, fieldCode: entry.fieldCode, value: roundQlktValue(entry.value), note: "" }));
        const response = await fetch("/api/daily-inputs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ period, entries }) });
        const body = await response.json() as { error?: string; saved?: number };
        if (!response.ok) throw new Error(body.error || "Chưa lưu được dữ liệu.");
        saved.push(date);
      } catch (caught) { failed.push({ date, error: caught instanceof Error ? caught.message : "Chưa lưu được dữ liệu." }); }
    }
    setRangeProgress(""); setSyncingRange(false);
    const cancelled = cancelRangeRef.current;
    const failedSummary = failed.length ? ` Lỗi ${failed.length} ngày: ${failed.slice(0, 5).map(item => `${item.date.split("-").reverse().join("/")} (${item.error})`).join("; ")}${failed.length > 5 ? "…" : ""}` : "";
    if (saved.length) setMessage(`Đã đồng bộ${cancelled ? " (dừng giữa chừng)" : ""} ${saved.length}/${dateList.length} ngày vào kho dữ liệu.${failedSummary}`);
    else setError(`Không đồng bộ được ngày nào.${failedSummary}`);
    await reloadForBothRanges();
  }

  async function applyQlktSync() {
    if (!pendingSync) return;
    const selected = pendingSync.entries.filter(entry => selectedSyncCodes.has(entry.fieldCode));
    if (!selected.length) { setPendingSync(null); return; }
    setSavingSync(true); setError("");
    try {
      const period = pendingSync.operatingDate.slice(0, 7);
      const entries = selected.map(entry => ({ operatingDate: pendingSync.operatingDate, fieldCode: entry.fieldCode, value: roundQlktValue(entry.value), note: "" }));
      const response = await fetch("/api/daily-inputs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ period, entries }) });
      const body = await response.json() as { error?: string; saved?: number };
      if (!response.ok) throw new Error(body.error || "Chưa lưu được dữ liệu.");
      setPendingSync(null);
      setMessage(`Đã lưu ${body.saved ?? selected.length} số liệu QLKT vào ngày ${pendingSync.operatingDate.split("-").reverse().join("/")}.`);
      if ((pendingSync.operatingDate >= fromDate && pendingSync.operatingDate <= toDate) || (pendingSync.operatingDate >= chartFromDate && pendingSync.operatingDate <= chartToDate)) await reloadForBothRanges();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Chưa lưu được dữ liệu."); }
    finally { setSavingSync(false); }
  }

  const dataByDate = useMemo(() => {
    const grouped = new Map<string, Record<string, string>>();
    for (const entry of dailyInputs) grouped.set(entry.operatingDate, { ...(grouped.get(entry.operatingDate) || {}), [entry.fieldCode]: entry.value });
    return grouped;
  }, [dailyInputs]);

  const dates = useMemo(() => datesBetween(fromDate, toDate), [fromDate, toDate]);
  const chartDates = useMemo(() => datesBetween(chartFromDate, chartToDate), [chartFromDate, chartToDate]);

  function valueFor(unit: Unit, metric: typeof METRICS[number], date: string) {
    const values = dataByDate.get(date) || {};
    const n = (code: string) => numberValue(values[code]);
    if (metric.key === "NH3") return unit === "s1" ? safeDivide(n("BQ"), n("B")) : safeDivide(n("BR"), n("H"));
    return n(metric.codes![unit]);
  }

  return <section className="flex min-h-[calc(100vh-88px)] flex-col gap-2">
    <h1 className="text-xl font-extrabold tracking-tight text-[#18233d]">Bảng thông số tổn thất khói</h1>

    {/* Cả 2 nhóm điều khiển (xem báo cáo + đồng bộ nhiều ngày) gộp vào đúng 1 hàng trên cùng để
        nhường tối đa chiều cao còn lại cho bảng và biểu đồ bên dưới. */}
    <div className="flex flex-wrap items-end gap-x-4 gap-y-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      <label className="grid gap-0.5 text-[10px] font-bold text-slate-600">TỪ NGÀY<DateField value={fromDate} max={toDate} onChange={setFromDate} className="h-8 w-[128px]"/></label>
      <label className="grid gap-0.5 text-[10px] font-bold text-slate-600">ĐẾN NGÀY<DateField value={toDate} min={fromDate} max={today} onChange={setToDate} className="h-8 w-[128px]"/></label>
      <button type="button" onClick={applyManualRange} className="h-8 rounded-xl border border-[#aebfe1] bg-[#eef3ff] px-3 text-xs font-bold text-[#354a9f]">Áp dụng</button>
      <label className="grid gap-0.5 text-[10px] font-bold text-slate-600">NGÀY ĐỒNG BỘ<DateField value={syncDate} onChange={setSyncDate} className="h-8 w-[128px]"/></label>
      <button type="button" disabled={syncingQlkt} onClick={syncFromQlkt} className="h-8 rounded-xl bg-gradient-to-r from-[#4057b5] to-[#438ec1] px-3 text-xs font-bold text-white shadow-md disabled:cursor-wait disabled:opacity-60">{syncingQlkt ? "Đang đồng bộ…" : "Đồng bộ QLKT"}</button>
      <div className="h-7 w-px bg-slate-200"/>
      <label className="grid gap-0.5 text-[10px] font-bold text-slate-600">ĐỒNG BỘ TỪ<DateField value={syncRangeFrom} max={syncRangeTo} onChange={setSyncRangeFrom} className="h-8 w-[128px]"/></label>
      <label className="grid gap-0.5 text-[10px] font-bold text-slate-600">ĐẾN<DateField value={syncRangeTo} min={syncRangeFrom} max={today} onChange={setSyncRangeTo} className="h-8 w-[128px]"/></label>
      {syncingRange ? <button type="button" onClick={cancelRangeSync} className="h-8 rounded-xl border border-red-300 bg-red-50 px-3 text-xs font-bold text-red-700">Dừng</button>
        : <button type="button" disabled={syncingQlkt} onClick={() => void syncRangeFromQlkt()} className="h-8 rounded-xl bg-gradient-to-r from-[#4057b5] to-[#438ec1] px-3 text-xs font-bold text-white shadow-md disabled:cursor-wait disabled:opacity-60">Đồng bộ khoảng ngày</button>}
      <p className="max-w-[220px] text-[10px] font-semibold text-slate-500">{rangeProgress || "Tự lưu thẳng, không hỏi lại — tối đa 62 ngày/lần."}</p>
      <p className={`text-[10px] font-semibold ${extensionVersion ? "text-emerald-700" : "text-amber-700"}`}>{extensionVersion ? `Tiện ích v${extensionVersion} đã kết nối` : "Chưa kết nối tiện ích"}</p>
      <p className="ml-auto text-[11px] font-semibold text-slate-500">{loading ? "Đang tải…" : `${dates.length} ngày`}</p>
    </div>

    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900">{message}</p>}

    <PmisTable dates={dates} valueFor={valueFor}/>

    <div className="flex flex-wrap items-end gap-x-3 gap-y-1 rounded-2xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
      <p className="text-[11px] font-extrabold text-[#18233d]">Biểu đồ</p>
      <label className="grid gap-0.5 text-[10px] font-bold text-slate-600">TỪ NGÀY<DateField value={chartFromDate} max={chartToDate} onChange={setChartFromDate} className="h-7 w-[120px]"/></label>
      <label className="grid gap-0.5 text-[10px] font-bold text-slate-600">ĐẾN NGÀY<DateField value={chartToDate} min={chartFromDate} max={today} onChange={setChartToDate} className="h-7 w-[120px]"/></label>
      <button type="button" onClick={applyChartRange} className="h-7 rounded-xl border border-[#aebfe1] bg-[#eef3ff] px-3 text-xs font-bold text-[#354a9f]">Áp dụng</button>
      <p className="ml-auto text-[11px] font-semibold text-slate-500">{chartDates.length} ngày</p>
    </div>

    <PmisCharts dates={chartDates} valueFor={valueFor}/>

    <DialogPrimitive.Root open={syncHelp} onOpenChange={setSyncHelp}><DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45"/><DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl outline-none"><DialogPrimitive.Title className="text-lg font-bold text-[#173b64]">Đồng bộ dữ liệu QLKT</DialogPrimitive.Title><DialogPrimitive.Description className="text-sm leading-6 text-slate-600">Mở màn hình &quot;Tính toán hiệu suất lò/suất hao nhiệt&quot; trên QLKT, chọn đúng tổ máy và ngày cần lấy, rồi nhấn &quot;Đồng bộ QLKT&quot; trên trang này (hoặc dùng nút &quot;Đồng bộ trang hiện tại&quot; trong tiện ích).</DialogPrimitive.Description><div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-[#274f78]"><p className="font-bold">Tiện ích không đọc hoặc lưu mật khẩu.</p><p className="mt-1">Dữ liệu luôn quay về bảng kiểm tra trước và chỉ được lưu khi bạn xác nhận.</p></div><div className="flex justify-end gap-2"><button type="button" onClick={() => setSyncHelp(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Đóng</button><a href="/qlkt-sync-extension.zip" download className="rounded-lg bg-[#334785] px-4 py-2 text-sm font-semibold text-white">Tải tiện ích mới</a></div></DialogPrimitive.Content></DialogPrimitive.Portal></DialogPrimitive.Root>

    <DialogPrimitive.Root open={Boolean(pendingSync)} onOpenChange={open => { if (!open) setPendingSync(null); }}><DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45"/><DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 grid max-h-[86vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl outline-none"><div><DialogPrimitive.Title className="text-lg font-bold text-[#173b64]">Kiểm tra dữ liệu từ QLKT</DialogPrimitive.Title><DialogPrimitive.Description className="mt-1 text-sm text-slate-600">Ngày {pendingSync ? pendingSync.operatingDate.split("-").reverse().join("/") : ""}. Bỏ chọn chỉ tiêu chưa muốn cập nhật.</DialogPrimitive.Description></div><div className="overflow-auto rounded-xl border border-slate-200"><table className="w-full text-sm"><thead><tr className="bg-[#dcebf5] text-[#173b64]"><th className="w-10 p-2 text-center">Chọn</th><th className="p-2 text-left">Chỉ tiêu</th><th className="p-2 text-center">Từ QLKT</th></tr></thead><tbody>{pendingSync?.entries.map(entry => <tr key={entry.fieldCode} className="border-t"><td className="p-2 text-center"><input type="checkbox" checked={selectedSyncCodes.has(entry.fieldCode)} onChange={event => setSelectedSyncCodes(old => { const next = new Set(old); if (event.target.checked) next.add(entry.fieldCode); else next.delete(entry.fieldCode); return next; })} aria-label={`Chọn ${qlktFieldLabels[entry.fieldCode]}`}/></td><td className="p-2"><p className="font-semibold text-black">{qlktFieldLabels[entry.fieldCode] || entry.fieldCode}</p><p className="text-xs text-slate-500">{entry.sourceLabel}</p></td><td className="p-2 text-center font-bold tabular-nums text-[#173b64]">{formatInputValue(entry.value)}</td></tr>)}</tbody></table></div><div className="flex items-center justify-between gap-3"><p className="text-xs text-slate-500">Bấm &quot;Lưu vào kho dữ liệu&quot; để ghi ngay các chỉ tiêu đã chọn.</p><div className="flex gap-2"><button type="button" onClick={() => setPendingSync(null)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Hủy</button><button type="button" disabled={savingSync || selectedSyncCodes.size === 0} onClick={() => void applyQlktSync()} className="rounded-lg bg-[#334785] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{savingSync ? "Đang lưu…" : "Lưu vào kho dữ liệu"}</button></div></div></DialogPrimitive.Content></DialogPrimitive.Portal></DialogPrimitive.Root>
  </section>;
}

type ValueFor = (unit: Unit, metric: typeof METRICS[number], date: string) => number | null;

// 1 bảng duy nhất, cuộn ngang khi nhiều ngày (đã bỏ kiểu đóng băng 5 ngày đầu trước đây theo yêu
// cầu) — cột nhãn chỉ tiêu vẫn đứng yên bên trái nhờ `sticky left-0` (không cần tách 2 <table>/2
// bảng riêng như trước, nên không còn phải lo lệch hàng giữa 2 bảng).
function PmisTable({ dates, valueFor }: { dates: string[]; valueFor: ValueFor }) {
  if (!dates.length) return <div className="grid min-h-40 place-items-center rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">Chưa chọn khoảng ngày hợp lệ.</div>;
  const dateColClass = `${HEADER_ROW_H} min-w-14 border border-[#c9791a] bg-[#e8973a] px-1.5 text-center align-middle text-[11px] font-extrabold text-white`;
  return <div className="shrink-0 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
    <table className="w-full border-collapse text-xs" style={{ minWidth: `${LABEL_COL_PX + Math.max(dates.length, 12) * 56}px` }}>
      <thead><tr>
        <th className={`${HEADER_ROW_H} ${LABEL_COL} sticky left-0 z-10 border border-[#1d3f7a] bg-[#1d3f7a] px-1.5 text-left align-middle text-xs font-extrabold text-white`}>THEO PMIS</th>
        {dates.map(date => <th key={date} className={dateColClass}>{ddMM(date)}</th>)}
      </tr></thead>
      <tbody>
        {(["s1", "s2"] as Unit[]).map(unit => <PmisUnitRows key={unit} unit={unit} dates={dates} valueFor={valueFor} withLabel/>)}
      </tbody>
    </table>
  </div>;
}

function PmisUnitRows({ unit, dates, valueFor, withLabel }: { unit: Unit; dates: string[]; valueFor: ValueFor; withLabel: boolean }) {
  return <>
    <tr><td colSpan={dates.length + (withLabel ? 1 : 0)} className={`${BAND_ROW_H} border border-[#c9791a] bg-[#f0a53a] px-2 align-middle text-xs font-extrabold text-white`}>{withLabel ? UNIT_LABEL[unit] : " "}</td></tr>
    {METRICS.map(metric => {
      const label = metric.label + (metric.unit ? ` (${metric.unit})` : "");
      return <tr key={metric.key}>
        {withLabel && <td title={label} className={`${METRIC_ROW_H} ${LABEL_COL} sticky left-0 z-10 truncate border border-slate-200 bg-[#fff6b0] px-2 align-middle text-left text-[11px] font-extrabold italic text-[#5a4a06]`}>{label}</td>}
        {dates.map(date => <td key={date} className={`${METRIC_ROW_H} min-w-14 border border-slate-200 px-1.5 align-middle text-center tabular-nums text-black`}>{format(valueFor(unit, metric, date))}</td>)}
      </tr>;
    })}
  </>;
}

function chartDataForUnit(unit: Unit, dates: string[], valueFor: ValueFor) {
  return dates.map(date => {
    const row: Record<string, string | number | null> = { date: ddMM(date) };
    METRICS.forEach(metric => { row[metric.key] = valueFor(unit, metric, date); });
    return row;
  });
}

// 5 chỉ tiêu có 5 đơn vị đo khác nhau (MW/%/kPa/°C/g·kWh⁻¹) và biên độ dao động rất khác nhau
// (PG vài trăm MW, PBN chỉ lệch 1-2 kPa quanh -93) — nếu dùng chung 1 trục Y theo giá trị gốc thì
// chỉ tiêu biên độ nhỏ sẽ nhìn như đường thẳng. Vì vậy mỗi chỉ tiêu có 1 trục Y RIÊNG (ẩn, không vẽ
// đường/nhãn trục) chỉ để tính tỷ lệ hiển thị cho đúng đường của nó — vẫn hiện chung 1 biểu đồ, 1
// hệ trục X (ngày) như yêu cầu, nhưng mỗi đường được "phóng to" theo đúng biên độ riêng nên luôn
// thấy rõ thay đổi dù đơn vị/biên độ khác nhau xa. PG dùng khoảng cố định 400–625 MW theo yêu cầu;
// các chỉ tiêu còn lại tự tính khoảng theo min/max thực tế + đệm 12% (tối thiểu 1 đơn vị) mỗi bên.
const METRIC_DOMAIN: Partial<Record<string, [number, number]>> = { PG: [400, 625] };
function domainFor(key: string): [AxisDomainItem, AxisDomainItem] {
  const fixed = METRIC_DOMAIN[key];
  if (fixed) return fixed;
  return [
    (min: number) => Number.isFinite(min) ? min - Math.max(Math.abs(min) * 0.12, 1) : 0,
    (max: number) => Number.isFinite(max) ? max + Math.max(Math.abs(max) * 0.12, 1) : 1,
  ];
}

function metricTooltipFormatter(value: unknown, name?: string | number) {
  const metric = METRICS.find(m => m.key === name);
  const label = metric ? metric.label + (metric.unit ? ` (${metric.unit})` : "") : String(name ?? "");
  return [format(typeof value === "number" ? value : Number(value)), label];
}

// Biểu đồ theo ngày: đúng 2 biểu đồ đặt cạnh nhau — S1 bên trái, S2 bên phải — mỗi biểu đồ gộp
// chung cả 5 chỉ tiêu theo đúng giá trị gốc (xem domainFor ở trên về cách mỗi đường có khoảng hiển
// thị riêng). Nét vẽ tô đậm (strokeWidth 3, màu bão hòa cao) để dễ phân biệt.
function PmisCharts({ dates, valueFor }: { dates: string[]; valueFor: ValueFor }) {
  if (!dates.length) return null;
  return <div className="grid min-h-[360px] flex-1 grid-cols-2 gap-2">
    {(["s1", "s2"] as Unit[]).map(unit => {
      const data = chartDataForUnit(unit, dates, valueFor);
      return <div key={unit} className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <p className="text-xs font-extrabold" style={{ color: UNIT_COLOR[unit] }}>{UNIT_LABEL[unit]}</p>
        <div className="mt-1 min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid horizontal vertical={false} strokeDasharray="4 4" stroke="#c9d2e0" yAxisId="PG"/>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd"/>
              <YAxis yAxisId="PG" hide domain={domainFor("PG")}/>
              {METRICS.filter(m => m.key !== "PG").map(metric => <YAxis key={metric.key} yAxisId={metric.key} hide domain={domainFor(metric.key)}/>)}
              <Tooltip formatter={metricTooltipFormatter} labelFormatter={label => `Ngày ${label}`}/>
              <Legend wrapperStyle={{ fontSize: 10 }} formatter={value => { const metric = METRICS.find(m => m.key === value); return metric ? metric.label : value; }}/>
              {METRICS.map(metric => <Line key={metric.key} yAxisId={metric.key} type="monotone" dataKey={metric.key} name={metric.key} stroke={METRIC_COLOR[metric.key]} strokeWidth={3} dot={false} connectNulls/>)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>;
    })}
  </div>;
}
