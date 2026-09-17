"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { parseGoogleSheetAssessmentRows, resolveGoogleSheetRow, validateGoogleAppsScriptUrl, type GoogleSheetAssessmentEntry, type GoogleSheetDayPayload } from "@/lib/google-sheet-sync";

const URL_KEY = "ctktkt-google-script-url";
const TOKEN_KEY = "ctktkt-google-script-token";
const numberFormat = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const format = (value: number | null | undefined) => value === null || value === undefined || !Number.isFinite(value) ? "—" : numberFormat.format(value);

type PreviewResponse = { preview?: GoogleSheetDayPayload; error?: string };

export function GoogleSheetSyncButton({ operatingDate, disabled = false, disabledReason = "", onImported }: { operatingDate: string; disabled?: boolean; disabledReason?: string; onImported?: () => void | Promise<void> }) {
  const [scriptUrl, setScriptUrl] = useState(() => typeof window === "undefined" ? "" : window.localStorage.getItem(URL_KEY) || "");
  const [token, setToken] = useState(() => typeof window === "undefined" ? "" : window.localStorage.getItem(TOKEN_KEY) || "");
  const [settingsOpen, setSettingsOpen] = useState(false), [preview, setPreview] = useState<GoogleSheetDayPayload | null>(null);
  const [assessmentPreview, setAssessmentPreview] = useState<GoogleSheetAssessmentEntry[] | null>(null);
  const [pendingAction, setPendingAction] = useState<"push" | "import">("push");
  const [loading, setLoading] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");

  async function requestPreview() {
    const response = await fetch("/api/google-sheet-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operatingDate }),
    });
    const body = await response.json() as PreviewResponse;
    if (!response.ok) throw new Error(body.error || "Không đồng bộ được Google Sheet.");
    return body;
  }

  async function readSheetRow() {
    const datesUrl = new URL(validateGoogleAppsScriptUrl(scriptUrl.trim()));
    datesUrl.searchParams.set("action", "dates");
    const response = await fetch(datesUrl.toString(), { method: "GET", cache: "no-store" });
    const body = await response.json() as { ok?: boolean; error?: string; rows?: unknown };
    if (!response.ok || !body.ok) throw new Error(body.error || "Không đọc được danh sách ngày từ Google Sheet.");
    const row = resolveGoogleSheetRow(operatingDate, body.rows);
    if (!row) throw new Error(`Không tìm thấy ngày ${operatingDate.split("-").reverse().join("/")} trong cột Ngày của trang DH1.`);
    return row;
  }

  async function loadPreview() {
    setLoading(true); setError(""); setMessage("");
    try {
      validateGoogleAppsScriptUrl(scriptUrl.trim());
      const [body, row] = await Promise.all([requestPreview(), readSheetRow()]);
      if (!body.preview) throw new Error("Web chưa tạo được dữ liệu xem trước.");
      setPreview({ ...body.preview, row });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không kiểm tra được Google Sheet."); }
    finally { setLoading(false); }
  }

  function start() {
    setError(""); setMessage("");
    setPendingAction("push");
    if (!scriptUrl.trim() || !token) { setSettingsOpen(true); return; }
    void loadPreview();
  }

  async function loadHistoricalAssessments() {
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch(validateGoogleAppsScriptUrl(scriptUrl.trim()), {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ token, action: "readAssessments" }),
      });
      const body = await response.json() as { ok?: boolean; error?: string; rows?: unknown };
      if (!response.ok || body.ok === false) throw new Error(body.error || "Apps Script chưa đọc được cột Đánh giá.");
      const rows = parseGoogleSheetAssessmentRows(body.rows);
      if (!rows.length) throw new Error("Google Sheet chưa có đánh giá S1/S2 để nhập.");
      setAssessmentPreview(rows);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không đọc được đánh giá lịch sử từ Google Sheet."); }
    finally { setLoading(false); }
  }

  function startHistoricalImport() {
    setError(""); setMessage(""); setPendingAction("import");
    if (!scriptUrl.trim() || !token) { setSettingsOpen(true); return; }
    void loadHistoricalAssessments();
  }

  function saveSettings() {
    if (!scriptUrl.trim() || !token) { setError("Hãy nhập đủ URL Apps Script và mã kết nối."); return; }
    let validatedUrl: string;
    try {
      validatedUrl = validateGoogleAppsScriptUrl(scriptUrl.trim());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "URL Apps Script không hợp lệ.");
      return;
    }
    window.localStorage.setItem(URL_KEY, validatedUrl);
    window.localStorage.setItem(TOKEN_KEY, token);
    setScriptUrl(validatedUrl);
    setSettingsOpen(false);
    if (pendingAction === "import") void loadHistoricalAssessments();
    else void loadPreview();
  }

  async function importHistoricalAssessments() {
    setLoading(true); setError(""); setMessage("");
    try {
      if (!assessmentPreview?.length) throw new Error("Chưa có đánh giá lịch sử để nhập.");
      const response = await fetch("/api/ppa-heat-rate/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: assessmentPreview.map(item => ({ operatingDate: item.iso, noteS1: item.noteS1, noteS2: item.noteS2 })) }),
      });
      const body = await response.json() as { updated?: number; skipped?: number; error?: string };
      if (!response.ok) throw new Error(body.error || "Web chưa lưu được đánh giá lịch sử.");
      setAssessmentPreview(null);
      setMessage(`Đã nhập đánh giá cho ${body.updated || 0} ngày. ${body.skipped ? `${body.skipped} ngày chưa có kết quả PPA trên web nên được bỏ qua.` : ""}`.trim());
      await onImported?.();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không nhập được đánh giá lịch sử."); }
    finally { setLoading(false); }
  }

  async function sync() {
    setLoading(true); setError(""); setMessage("");
    try {
      if (!preview) throw new Error("Chưa có dữ liệu xem trước để gửi.");
      const response = await fetch(validateGoogleAppsScriptUrl(scriptUrl.trim()), {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ token, days: [preview] }),
      });
      const body = await response.json() as { ok?: boolean; error?: string; results?: Array<{ status?: string }> };
      if (!response.ok || body.ok === false) throw new Error(body.error || "Google Apps Script không ghi được dữ liệu.");
      if (!body.results?.some(item => item.status === "ok")) throw new Error("Google Apps Script chưa xác nhận ghi dữ liệu thành công.");
      const row = preview.row;
      setPreview(null);
      setMessage(`Đã ghi ngày ${operatingDate.split("-").reverse().join("/")} vào hàng ${row} của trang DH1.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không ghi được Google Sheet."); }
    finally { setLoading(false); }
  }

  const rows = preview ? [["S1", preview.S1], ["S2", preview.S2], ["NMNĐ", preview.NMND]] as const : [];
  const displayDate = operatingDate.split("-").reverse().join("/");

  return <>
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1">
        <button type="button" disabled={loading || disabled} onClick={start} title={disabled ? disabledReason : `Đẩy dữ liệu ngày ${displayDate} lên Google Sheet`} className="h-10 whitespace-nowrap rounded-xl border border-emerald-300 bg-emerald-50 px-4 text-sm font-bold text-emerald-800 shadow-sm disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:opacity-80">{loading ? "Đang kiểm tra…" : `Đẩy Google Sheet · ${displayDate}`}</button>
        <button type="button" disabled={loading} onClick={startHistoricalImport} title="Nhập một lần các đánh giá S1/S2 cũ từ Google Sheet về web" className="h-10 whitespace-nowrap rounded-xl border border-amber-300 bg-amber-50 px-3 text-sm font-bold text-amber-800 shadow-sm disabled:opacity-60">Nhập đánh giá cũ</button>
        <button type="button" onClick={() => { setError(""); setSettingsOpen(true); }} aria-label="Cài đặt đồng bộ Google Sheet" title="Cài đặt Google Sheet" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 shadow-sm">⚙</button>
      </div>
      {disabled && disabledReason && <p className="max-w-sm text-right text-[11px] font-semibold text-amber-700">{disabledReason}</p>}
      {message && <p role="status" className="max-w-sm text-right text-[11px] font-semibold text-emerald-700">{message}</p>}
      {error && <p role="alert" className="max-w-sm text-right text-[11px] font-semibold text-red-700">{error}</p>}
    </div>

    <DialogPrimitive.Root open={settingsOpen} onOpenChange={setSettingsOpen}><DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45"/>
      <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl outline-none">
        <div><DialogPrimitive.Title className="text-lg font-bold text-[#173b64]">Thiết lập Google Sheet</DialogPrimitive.Title><DialogPrimitive.Description className="mt-1 text-sm leading-6 text-slate-600">Chỉ thiết lập một lần trên máy này. URL và mã kết nối được giữ trong trình duyệt, không ghi vào GitHub.</DialogPrimitive.Description></div>
        <label className="grid gap-1 text-sm font-bold text-slate-700">
          Apps Script URL (phải kết thúc bằng /exec)
          <input value={scriptUrl} onChange={event => setScriptUrl(event.target.value)} placeholder="https://script.google.com/macros/s/.../exec" className="rounded-xl border border-slate-300 px-3 py-2 font-normal text-black"/>
          <span className="font-normal text-red-700">Không dán link docs.google.com/spreadsheets/... vào ô này.</span>
        </label>
        <label className="grid gap-1 text-sm font-bold text-slate-700">
          Mã kết nối
          <input type="password" value={token} onChange={event => setToken(event.target.value)} autoComplete="off" className="rounded-xl border border-slate-300 px-3 py-2 font-normal text-black"/>
          <span className="font-normal text-slate-500">Đây là Token trong công cụ “Đồng bộ DH1”, không phải mật khẩu Google.</span>
        </label>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold leading-5 text-red-700">{error}</p>}
        <p className="text-xs leading-5 text-slate-500">Hai giá trị chỉ được lưu trong trình duyệt của máy này và không ghi vào GitHub.</p>
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setSettingsOpen(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Hủy</button><button type="button" onClick={saveSettings} className="rounded-lg bg-[#334785] px-4 py-2 text-sm font-semibold text-white">Lưu và kiểm tra</button></div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal></DialogPrimitive.Root>

    <DialogPrimitive.Root open={Boolean(assessmentPreview)} onOpenChange={open => { if (!open && !loading) setAssessmentPreview(null); }}><DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45"/>
      <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 grid max-h-[88vh] w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl outline-none">
        <div><DialogPrimitive.Title className="text-lg font-bold text-[#173b64]">Nhập đánh giá lịch sử từ Google Sheet</DialogPrimitive.Title><DialogPrimitive.Description className="mt-1 text-sm leading-6 text-slate-600">Tìm thấy {assessmentPreview?.length || 0} ngày có đánh giá. Chỉ hai ghi chú S1/S2 của ngày đã có PPA trên web được cập nhật; mọi số liệu khác giữ nguyên.</DialogPrimitive.Description></div>
        <div className="overflow-auto rounded-xl border border-slate-200"><table className="w-full min-w-[760px] text-xs"><thead><tr className="bg-[#dcebf5] text-[#173b64]"><th className="w-28 p-2 text-left">Ngày</th><th className="p-2 text-left">Đánh giá S1</th><th className="p-2 text-left">Đánh giá S2</th></tr></thead><tbody>{assessmentPreview?.map(item => <tr key={item.iso} className="border-t align-top text-black"><td className="p-2 font-bold">{item.iso.split("-").reverse().join("/")}</td><td className="whitespace-pre-wrap p-2 leading-5">{item.noteS1 || "—"}</td><td className="whitespace-pre-wrap p-2 leading-5">{item.noteS2 || "—"}</td></tr>)}</tbody></table></div>
        <div className="flex items-center justify-between gap-3"><p className="text-xs text-slate-500">Đây là thao tác nhập lịch sử một lần. Sau đó web là nguồn chính để đẩy dữ liệu lên Google Sheet.</p><div className="flex shrink-0 gap-2"><button type="button" disabled={loading} onClick={() => setAssessmentPreview(null)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Hủy</button><button type="button" disabled={loading} onClick={() => void importHistoricalAssessments()} className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{loading ? "Đang nhập…" : "Xác nhận nhập về web"}</button></div></div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal></DialogPrimitive.Root>

    <DialogPrimitive.Root open={Boolean(preview)} onOpenChange={open => { if (!open && !loading) setPreview(null); }}><DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45"/>
      <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 grid max-h-[88vh] w-[calc(100%-2rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl outline-none">
        <div><DialogPrimitive.Title className="text-lg font-bold text-[#173b64]">Kiểm tra dữ liệu gửi Google Sheet</DialogPrimitive.Title><DialogPrimitive.Description className="mt-1 text-sm text-slate-600">Ngày {operatingDate.split("-").reverse().join("/")} · trang DH1 · hàng {preview?.row}. Chưa ghi dữ liệu cho đến khi bạn xác nhận.</DialogPrimitive.Description></div>
        <div className="overflow-auto rounded-xl border border-slate-200"><table className="min-w-[1050px] w-full text-xs"><thead><tr className="bg-[#dcebf5] text-[#173b64]"><th className="p-2 text-left">Phạm vi</th><th className="p-2">Sản lượng</th><th className="p-2">CS bình quân</th><th className="p-2">Suất hao than</th><th className="p-2">Nhiệt trị</th><th className="p-2">SHN thực tế</th><th className="p-2">SHN PPA</th><th className="p-2">Chênh lệch</th><th className="p-2 text-left">Đánh giá</th></tr></thead><tbody>{rows.map(([label, row]) => <tr key={label} className="border-t text-black"><td className="p-2 font-bold">{label}</td><td className="p-2 text-center">{format(row.sanLuong)}</td><td className="p-2 text-center">{format(row.csBinhQuan)}</td><td className="p-2 text-center">{format(row.suatHaoThan)}</td><td className="p-2 text-center">{format(row.nhietTri)}</td><td className="p-2 text-center">{format(row.shnThucTe)}</td><td className="p-2 text-center">{format(row.shnPPA)}</td><td className="p-2 text-center">{row.chenhLech || "—"}</td><td className="p-2">{row.danhGia || "—"}</td></tr>)}</tbody></table></div>
        <div className="flex items-center justify-between gap-3"><p className="text-xs text-slate-500">Các cột tình hình vận hành và chỉ đạo không bị thay đổi. Cột công suất khả dụng được giữ nguyên vì web hiện chưa có nguồn tương ứng.</p><div className="flex shrink-0 gap-2"><button type="button" disabled={loading} onClick={() => setPreview(null)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Hủy</button><button type="button" disabled={loading} onClick={() => void sync()} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{loading ? "Đang ghi…" : "Xác nhận đẩy lên Sheet"}</button></div></div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal></DialogPrimitive.Root>
  </>;
}
