"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DateField } from "@/components/ui/date-field";
import { calculateActualHeatRate, calculatePpaHeatRate, compareHeatRate, mergeMeterReadings, parseMeterCsv, selectPpaSource, type MeterReading, type PpaResult } from "@/lib/ppa-heat-rate";
import { decodeQlktPpaSyncHash, validateQlktPpaSyncPayload } from "@/lib/qlkt-sync";
import { useSessionUser } from "@/components/session-context";
import { hasPermission } from "@/lib/auth/session";

type DailyInput = { operatingDate: string; fieldCode: string; value: string };
type StoredPpa = PpaResult & { operatingDate: string; sourceFiles: string; noteS1: string; noteS2: string; updatedAt: string };

const localToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
// Số liệu vận hành của ngày hôm nay thường chưa có (đến sáng hôm sau mới đủ) nên mặc định mở trang
// là ngày hôm qua (D-1), người dùng cần ngày khác thì tự đổi.
const localYesterday = () => {
  const date = new Date(`${localToday()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};
const numberFormat = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const format = (value: number | null | undefined) => value === null || value === undefined || !Number.isFinite(value) ? "—" : numberFormat.format(value);

async function readCsvFile(file: File) {
  const buffer = await file.arrayBuffer();
  let text = new TextDecoder("utf-8").decode(buffer);
  if (text.includes("�")) {
    try { text = new TextDecoder("windows-1258").decode(buffer); } catch { /* keep UTF-8 text */ }
  }
  return text;
}

export function PpaHeatRateComparison() {
  const user = useSessionUser();
  const isViewer = !hasPermission(user, "edit_ppa");
  const [operatingDate, setOperatingDate] = useState(localYesterday), [readings, setReadings] = useState<MeterReading[]>([]), [sourceFiles, setSourceFiles] = useState<string[]>([]);
  const [pastedText, setPastedText] = useState(""), [noteS1, setNoteS1] = useState(""), [noteS2, setNoteS2] = useState("");
  const [dailyInputs, setDailyInputs] = useState<DailyInput[]>([]), [history, setHistory] = useState<StoredPpa[]>([]);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [extensionVersion, setExtensionVersion] = useState(""), [syncingQlkt, setSyncingQlkt] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qlktRequestRef = useRef<{ id: string; timer: number } | null>(null);
  const period = operatingDate.slice(0, 7);

  async function loadPeriod() {
    setLoading(true); setError("");
    try {
      const [dailyResponse, ppaResponse] = await Promise.all([fetch(`/api/daily-inputs?period=${period}`, { cache: "no-store" }), fetch(`/api/ppa-heat-rate?period=${period}`, { cache: "no-store" })]);
      const dailyBody = await dailyResponse.json() as { entries?: DailyInput[]; error?: string }, ppaBody = await ppaResponse.json() as { entries?: StoredPpa[]; error?: string };
      if (!dailyResponse.ok) throw new Error(dailyBody.error || "Không tải được dữ liệu KTKT.");
      if (!ppaResponse.ok) throw new Error(ppaBody.error || "Không tải được lịch sử PPA.");
      setDailyInputs(dailyBody.entries || []); setHistory(ppaBody.entries || []);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không tải được dữ liệu."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadPeriod(); }, [period]);

  useEffect(() => {
    const payload = decodeQlktPpaSyncHash(window.location.hash);
    if (!payload) return;
    const timer = window.setTimeout(() => {
      try {
        const mergedMap = mergeMeterReadings([payload.readings]);
        if (!selectPpaSource(mergedMap).source) throw new Error("Dữ liệu QLKT chưa đủ 4 điểm đo PPA.");
        setReadings([...mergedMap.values()]);
        setSourceFiles(["QLKT · Số liệu đo đếm công tơ"]);
        setOperatingDate(payload.operatingDate);
        setError("");
        setMessage("Đã nhận đủ 4 điểm đo và 48 chu kỳ từ QLKT. Hãy kiểm tra kết quả trước khi lưu.");
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Không đọc được dữ liệu công tơ từ QLKT.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const channel = "ctktkt-qlkt-sync";
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data as { channel?: string; sender?: string; type?: string; version?: string; requestId?: string; result?: { ok?: boolean; payload?: unknown; error?: string } };
      if (!data || data.channel !== channel || data.sender !== "ctktkt-extension") return;
      if (data.type === "READY") {
        setExtensionVersion(String(data.version || "đã kết nối"));
        return;
      }
      if (data.type !== "SYNC_PPA_RESULT" || !qlktRequestRef.current || data.requestId !== qlktRequestRef.current.id) return;
      window.clearTimeout(qlktRequestRef.current.timer);
      qlktRequestRef.current = null;
      setSyncingQlkt(false);
      if (!data.result?.ok) {
        setError(data.result?.error || "Chưa đồng bộ được dữ liệu từ QLKT.");
        return;
      }
      const payload = validateQlktPpaSyncPayload(data.result.payload);
      if (!payload) {
        setError("Dữ liệu tiện ích trả về chưa đủ 4 điểm đo và 48 chu kỳ.");
        return;
      }
      try {
        const mergedMap = mergeMeterReadings([payload.readings]);
        if (!selectPpaSource(mergedMap).source) throw new Error("Dữ liệu QLKT chưa đủ 4 điểm đo PPA.");
        setReadings([...mergedMap.values()]);
        setSourceFiles(["QLKT · Số liệu đo đếm công tơ"]);
        setOperatingDate(payload.operatingDate);
        setError("");
        setMessage("Đồng bộ QLKT thành công: đã nhận đủ 4 điểm đo và 48 chu kỳ. Hãy kiểm tra kết quả trước khi lưu.");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Không đọc được dữ liệu công tơ từ QLKT.");
      }
    };
    window.addEventListener("message", handleMessage);
    window.postMessage({ channel, sender: "ctktkt-web", type: "PING" }, window.location.origin);
    return () => {
      window.removeEventListener("message", handleMessage);
      if (qlktRequestRef.current) window.clearTimeout(qlktRequestRef.current.timer);
    };
  }, []);

  const actualByDate = useMemo(() => {
    const grouped = new Map<string, Record<string, string>>();
    for (const entry of dailyInputs) grouped.set(entry.operatingDate, { ...(grouped.get(entry.operatingDate) || {}), [entry.fieldCode]: entry.value });
    return new Map([...grouped].map(([date, values]) => [date, calculateActualHeatRate(values)]));
  }, [dailyInputs]);
  const actual = actualByDate.get(operatingDate) || null;
  const selected = useMemo(() => selectPpaSource(mergeMeterReadings([readings])), [readings]);
  const calculation = useMemo(() => {
    if (!selected.source) return null;
    try { return calculatePpaHeatRate(selected.source, Number(operatingDate.slice(0, 4))); }
    catch { return null; }
  }, [selected.source, operatingDate]);

  function addParsed(next: MeterReading[], name: string) {
    const merged = mergeMeterReadings([readings, next]);
    const dates = [...new Set([...merged.values()].map(item => item.operatingDate).filter(Boolean))];
    if (dates.length > 1) throw new Error("Các CSV đang chứa nhiều ngày khác nhau. Chỉ đưa dữ liệu của một ngày trong mỗi lần tính.");
    setReadings([...merged.values()]);
    setSourceFiles(old => old.includes(name) ? old : [...old, name]);
    if (dates.length === 1) setOperatingDate(dates[0]);
  }

  function addPastedData() {
    setError(""); setMessage("");
    try {
      if (!pastedText.trim()) throw new Error("Hãy dán nội dung CSV vào ô trước.");
      addParsed(parseMeterCsv(pastedText, `Dữ liệu dán ${sourceFiles.length + 1}`), `Dữ liệu dán ${sourceFiles.length + 1}`);
      setPastedText(""); setMessage("Đã đọc dữ liệu vừa dán. Có thể dán tiếp CSV còn lại.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không đọc được dữ liệu CSV."); }
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(""); setMessage("");
    try {
      let merged = readings, names = sourceFiles;
      for (const file of [...files]) {
        const parsed = parseMeterCsv(await readCsvFile(file), file.name);
        merged = [...mergeMeterReadings([merged, parsed]).values()];
        if (!names.includes(file.name)) names = [...names, file.name];
      }
      const dates = [...new Set(merged.map(item => item.operatingDate).filter(Boolean))];
      if (dates.length > 1) throw new Error("Các CSV đang chứa nhiều ngày khác nhau. Chỉ chọn dữ liệu của một ngày trong mỗi lần tính.");
      setReadings(merged); setSourceFiles(names); if (dates.length === 1) setOperatingDate(dates[0]);
      setMessage(`Đã đọc ${files.length} file CSV.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không đọc được dữ liệu CSV."); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  }

  function clearImport() { setReadings([]); setSourceFiles([]); setPastedText(""); setNoteS1(""); setNoteS2(""); setMessage(""); setError(""); }

  function syncFromQlkt() {
    setError(""); setMessage("");
    if (!extensionVersion) {
      window.postMessage({ channel: "ctktkt-qlkt-sync", sender: "ctktkt-web", type: "PING" }, window.location.origin);
      setError("Web chưa kết nối với tiện ích QLKT. Hãy Reload tiện ích phiên bản 0.4.6 rồi nhấn F5 trang này.");
      return;
    }
    if (qlktRequestRef.current) window.clearTimeout(qlktRequestRef.current.timer);
    const requestId = crypto.randomUUID();
    const timer = window.setTimeout(() => {
      if (qlktRequestRef.current?.id !== requestId) return;
      qlktRequestRef.current = null;
      setSyncingQlkt(false);
      setError("QLKT phản hồi quá lâu. Hãy kiểm tra phiên đăng nhập QLKT rồi thử lại.");
    }, 90000);
    qlktRequestRef.current = { id: requestId, timer };
    setSyncingQlkt(true);
    window.postMessage({ channel: "ctktkt-qlkt-sync", sender: "ctktkt-web", type: "SYNC_PPA", requestId, operatingDate }, window.location.origin);
  }

  async function save() {
    if (!selected.source || !calculation) { setError("Chưa đủ 4 điểm đo bắt buộc để tính và lưu."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/ppa-heat-rate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operatingDate, source: selected.source, sourceFiles, noteS1, noteS2 }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Chưa lưu được kết quả.");
      setMessage(`Đã lưu kết quả so sánh ngày ${operatingDate.split("-").reverse().join("/")}.`);
      await loadPeriod();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Chưa lưu được kết quả."); }
    finally { setSaving(false); }
  }

  const comparisonRows = calculation ? [
    { label: "Chung 2 tổ", ppa: calculation.ppaPlant, actual: actual?.actualPlant ?? null },
    { label: "S1", ppa: calculation.ppaS1, actual: actual?.actualS1 ?? null },
    { label: "S2", ppa: calculation.ppaS2, actual: actual?.actualS2 ?? null },
  ] : [];

  return <section className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#557187]">Theo dõi hiệu suất vận hành</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#18233d]">So sánh suất hao nhiệt PPA và thực tế</h1><p className="mt-1 text-sm text-slate-500">Nhận trực tiếp từ QLKT hoặc chọn CSV công tơ. Hệ thống tự tính PPA theo 48 chu kỳ nửa giờ.</p></div><div className="flex flex-wrap items-end gap-2"><label className="grid gap-1 text-xs font-bold text-slate-600">NGÀY VẬN HÀNH<DateField value={operatingDate} onChange={value => { setOperatingDate(value); clearImport(); }} className="w-[150px]"/></label><button type="button" disabled={syncingQlkt} onClick={syncFromQlkt} className="h-10 rounded-xl bg-gradient-to-r from-[#4057b5] to-[#438ec1] px-4 text-sm font-bold text-white shadow-md disabled:cursor-wait disabled:opacity-60">{syncingQlkt ? "Đang đồng bộ…" : "Đồng bộ QLKT"}</button><p className={`w-full text-right text-[11px] font-semibold ${extensionVersion ? "text-emerald-700" : "text-amber-700"}`}>{extensionVersion ? `Tiện ích v${extensionVersion} đã kết nối` : "Chưa kết nối tiện ích"}</p></div></div>

    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900">{message}</p>}

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,.85fr)]">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-extrabold text-[#20345f]">1. Đưa dữ liệu PPA vào</h2><p className="mt-1 text-xs text-slate-500">Ưu tiên đồng bộ từ QLKT; chọn hoặc dán CSV được giữ làm phương án dự phòng.</p></div><div className="flex gap-2"><label className="cursor-pointer rounded-xl bg-[#4057b5] px-4 py-2 text-sm font-bold text-white shadow-sm">Chọn CSV<input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" multiple className="sr-only" onChange={event => void addFiles(event.target.files)}/></label><button type="button" onClick={clearImport} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-600">Làm lại</button></div></div>
        <textarea value={pastedText} onChange={event => setPastedText(event.target.value)} rows={6} placeholder="Dán nguyên nội dung CSV tại đây…" className="mt-4 w-full resize-y rounded-xl border border-slate-300 bg-[#fbfcfe] p-3 font-mono text-xs text-black outline-none focus:border-[#4c78a8] focus:ring-2 focus:ring-[#4c78a8]/20"/>
        <div className="mt-2 flex items-center justify-between gap-3"><p className="text-xs text-slate-500">Đã nhận: {sourceFiles.length ? sourceFiles.join(", ") : "chưa có CSV"}</p><button type="button" onClick={addPastedData} className="rounded-xl border border-[#aebfe1] bg-[#eef3ff] px-4 py-2 text-sm font-bold text-[#354a9f]">Thêm dữ liệu vừa dán</button></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">{selected.found.map(item => <div key={item.key} className={`rounded-xl border px-3 py-2 ${item.found ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><div className="flex items-center justify-between gap-2"><p className="text-sm font-bold text-slate-800">{item.label}</p><span className={`text-xs font-extrabold ${item.found ? "text-emerald-700" : "text-amber-800"}`}>{item.found ? "Đã nhận" : "Còn thiếu"}</span></div><p className="mt-0.5 text-xs text-slate-500">{item.meter} · {item.channel}</p></div>)}</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="font-extrabold text-[#20345f]">2. Kiểm tra nguồn tính</h2><p className="mt-1 text-xs text-slate-500">PPA lấy từ QLKT hoặc CSV. Thực tế lấy từ số liệu than, nhiệt trị và điểm bán đã lưu trong “Dữ liệu các tháng”.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2"><div className={`rounded-xl border p-3 ${calculation ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-slate-50"}`}><p className="text-xs font-bold text-slate-500">DỮ LIỆU PPA</p><p className="mt-1 text-lg font-extrabold text-[#314793]">{calculation ? "Đủ 4 điểm đo" : `${selected.found.filter(item => item.found).length}/4 điểm đo`}</p></div><div className={`rounded-xl border p-3 ${actual ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><p className="text-xs font-bold text-slate-500">DỮ LIỆU THỰC TẾ</p><p className={`mt-1 text-lg font-extrabold ${actual ? "text-emerald-700" : "text-amber-800"}`}>{actual ? "Đã có trên web" : "Còn thiếu dữ liệu KTKT"}</p></div></div>
        {calculation && <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs"><div className="rounded-lg border p-2"><p className="text-slate-500">Đầu cực S1</p><p className="font-bold text-black">{format(calculation.grossS1Kwh / 1_000_000)} triệu kWh</p></div><div className="rounded-lg border p-2"><p className="text-slate-500">Điểm bán S1</p><p className="font-bold text-black">{format(calculation.netS1Kwh / 1_000_000)} triệu kWh</p></div><div className="rounded-lg border p-2"><p className="text-slate-500">Đầu cực S2</p><p className="font-bold text-black">{format(calculation.grossS2Kwh / 1_000_000)} triệu kWh</p></div><div className="rounded-lg border p-2"><p className="text-slate-500">Điểm bán S2</p><p className="font-bold text-black">{format(calculation.netS2Kwh / 1_000_000)} triệu kWh</p></div></div>}
      </div>
    </div>

    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b bg-[#f8fafc] px-4 py-3"><h2 className="font-extrabold text-[#20345f]">3. Kết quả so sánh</h2></div>{!calculation ? <div className="grid min-h-40 place-items-center p-6 text-sm text-slate-500">Kết quả sẽ xuất hiện khi nhận đủ 4 điểm đo.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr className="bg-[#dcebf5] text-[#173b64]"><th className="p-3 text-left">Phạm vi</th><th className="p-3 text-center">PPA (kJ/kWh)</th><th className="p-3 text-center">Thực tế (kJ/kWh)</th><th className="p-3 text-center">Chênh lệch (kJ/kWh)</th><th className="p-3 text-center">Chênh lệch (%)</th><th className="p-3 text-center">Đánh giá</th></tr></thead><tbody>{comparisonRows.map(row => { const comparison = compareHeatRate(row.actual, row.ppa); return <tr key={row.label} className="border-t"><td className="p-3 font-bold text-black">{row.label}</td><td className="p-3 text-center tabular-nums text-black">{format(row.ppa)}</td><td className="p-3 text-center tabular-nums text-black">{format(row.actual)}</td><td className="p-3 text-center tabular-nums text-black">{format(comparison.difference)}</td><td className="p-3 text-center tabular-nums text-black">{format(comparison.percent)}</td><td className="p-3 text-center"><span className={`rounded-full px-3 py-1 text-xs font-extrabold ${comparison.status === "Đạt" ? "bg-emerald-100 text-emerald-800" : comparison.status === "Vượt PPA" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{comparison.status}</span></td></tr>; })}</tbody></table></div>}</div>

    {calculation && <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-2"><label className="grid gap-1 text-sm font-bold text-slate-700">Nguyên nhân chênh lệch S1<textarea value={noteS1} onChange={event => setNoteS1(event.target.value)} rows={3} className="resize-y rounded-xl border border-slate-300 p-3 font-normal text-black outline-none focus:border-[#4c78a8]" placeholder="Ghi nhận tình trạng vận hành, UC tro/xỉ, máy nghiền…"/></label><label className="grid gap-1 text-sm font-bold text-slate-700">Nguyên nhân chênh lệch S2<textarea value={noteS2} onChange={event => setNoteS2(event.target.value)} rows={3} className="resize-y rounded-xl border border-slate-300 p-3 font-normal text-black outline-none focus:border-[#4c78a8]" placeholder="Ghi nhận tình trạng vận hành, UC tro/xỉ, máy nghiền…"/></label><div className="flex justify-end lg:col-span-2"><button type="button" disabled={saving || isViewer} title={isViewer ? "Tài khoản Chỉ xem không có quyền lưu dữ liệu." : undefined} onClick={save} className="rounded-xl bg-gradient-to-r from-[#4057b5] to-[#438ec1] px-5 py-2.5 text-sm font-bold text-white shadow-md disabled:opacity-50">{saving ? "Đang lưu…" : "Lưu kết quả ngày"}</button></div></div>}

    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b bg-[#f8fafc] px-4 py-3"><h2 className="font-extrabold text-[#20345f]">Lịch sử trong tháng</h2><span className="text-xs font-semibold text-slate-500">{loading ? "Đang tải…" : `${history.length} ngày`}</span></div>{history.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">Chưa lưu kết quả PPA trong tháng này.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-xs"><thead><tr className="bg-[#dcebf5] text-[#173b64]"><th className="p-2 text-left">Ngày</th><th className="p-2 text-center">PPA chung</th><th className="p-2 text-center">Thực tế chung</th><th className="p-2 text-center">Chênh lệch</th><th className="p-2 text-center">Đánh giá</th><th className="p-2 text-center">PPA S1</th><th className="p-2 text-center">PPA S2</th></tr></thead><tbody>{history.map(entry => { const rowActual = actualByDate.get(entry.operatingDate), comparison = compareHeatRate(rowActual?.actualPlant ?? null, Number(entry.ppaPlant)); return <tr key={entry.operatingDate} className="border-t"><td className="p-2 font-bold text-black">{entry.operatingDate.split("-").reverse().join("/")}</td><td className="p-2 text-center text-black">{format(Number(entry.ppaPlant))}</td><td className="p-2 text-center text-black">{format(rowActual?.actualPlant)}</td><td className="p-2 text-center text-black">{format(comparison.difference)}</td><td className="p-2 text-center font-bold">{comparison.status}</td><td className="p-2 text-center text-black">{format(Number(entry.ppaS1))}</td><td className="p-2 text-center text-black">{format(Number(entry.ppaS2))}</td></tr>; })}</tbody></table></div>}</div>
  </section>;
}
