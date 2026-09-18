"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DateField } from "@/components/ui/date-field";
import { EVENT_TYPES, SHIFT_METRICS, SHIFT_TIME_SLOTS, type OperatingEvent, type ShiftMetric } from "@/lib/bcsx";
import { useSessionUser } from "@/components/session-context";
import { hasPermission } from "@/lib/auth/session";

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

type Unit = "S1" | "S2";
type ReadingsGrid = Record<ShiftMetric, string[]>;

function emptyGrid(): ReadingsGrid {
  return { P: SHIFT_TIME_SLOTS.map(() => ""), Q: SHIFT_TIME_SLOTS.map(() => ""), D: SHIFT_TIME_SLOTS.map(() => ""), E: SHIFT_TIME_SLOTS.map(() => "") };
}

type EventDraft = { startTime: string; endTime: string; eventType: number; description: string };

function blankEventDraft(): EventDraft {
  return { startTime: "", endTime: "", eventType: 1, description: "" };
}

// Đầu cực/thương phẩm/than tiêu thụ có mã QLKT-sync riêng theo tổ máy; than tồn
// kho là số toàn nhà máy (dùng chung 1 mã cho cả S1 và S2).
const TOTAL_FIELD_CODES: Record<Unit, { dauCuc: string; thuongPham: string; thanTieuThu: string; thanTonKho: string }> = {
  S1: { dauCuc: "B", thuongPham: "C", thanTieuThu: "AE", thanTonKho: "AR" },
  S2: { dauCuc: "H", thuongPham: "I", thanTieuThu: "AF", thanTonKho: "AR" },
};

type TotalsDraft = { dauCuc: string; thuongPham: string; thanTieuThu: string; thanTonKho: string };

function blankTotals(): TotalsDraft {
  return { dauCuc: "", thuongPham: "", thanTieuThu: "", thanTonKho: "" };
}

export function BcsxReport() {
  const user = useSessionUser();
  const isViewer = !hasPermission(user, "edit_bcsx");
  const [operatingDate, setOperatingDate] = useState(todayIso());
  const [unit, setUnit] = useState<Unit>("S1");
  const [grids, setGrids] = useState<Record<Unit, ReadingsGrid>>({ S1: emptyGrid(), S2: emptyGrid() });
  const [events, setEvents] = useState<Record<Unit, OperatingEvent[]>>({ S1: [], S2: [] });
  const [draft, setDraft] = useState<EventDraft>(blankEventDraft());
  const [totals, setTotals] = useState<Record<Unit, TotalsDraft>>({ S1: blankTotals(), S2: blankTotals() });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const [readingsRes, eventsRes, period] = [
          await fetch(`/api/shift-readings?date=${operatingDate}`),
          await fetch(`/api/operating-events?date=${operatingDate}`),
          operatingDate.slice(0, 7),
        ];
        const readingsJson = await readingsRes.json() as { entries?: { unit: Unit; timeSlot: string; metric: ShiftMetric; value: string }[]; error?: string };
        const eventsJson = await eventsRes.json() as { events?: (OperatingEvent & { unit: Unit })[]; error?: string };
        const totalsRes = await fetch(`/api/daily-inputs?period=${period}`);
        const totalsJson = await totalsRes.json() as { entries?: { operatingDate: string; fieldCode: string; value: string }[]; error?: string };
        if (cancelled) return;
        if (readingsJson.error || eventsJson.error) throw new Error(readingsJson.error || eventsJson.error);

        const nextGrids: Record<Unit, ReadingsGrid> = { S1: emptyGrid(), S2: emptyGrid() };
        const slotIndex = new Map(SHIFT_TIME_SLOTS.map((s, i) => [s, i]));
        for (const entry of readingsJson.entries || []) {
          const idx = slotIndex.get(entry.timeSlot);
          if (idx === undefined) continue;
          nextGrids[entry.unit][entry.metric][idx] = entry.value;
        }
        setGrids(nextGrids);

        const nextEvents: Record<Unit, OperatingEvent[]> = { S1: [], S2: [] };
        for (const e of eventsJson.events || []) nextEvents[e.unit]?.push(e);
        setEvents(nextEvents);

        const byCode = new Map((totalsJson.entries || []).filter(e => e.operatingDate === operatingDate).map(e => [e.fieldCode, e.value]));
        setTotals({
          S1: { dauCuc: byCode.get("B") || "", thuongPham: byCode.get("C") || "", thanTieuThu: byCode.get("AE") || "", thanTonKho: byCode.get("AR") || "" },
          S2: { dauCuc: byCode.get("H") || "", thuongPham: byCode.get("I") || "", thanTieuThu: byCode.get("AF") || "", thanTonKho: byCode.get("AR") || "" },
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không tải được dữ liệu.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [operatingDate]);

  const grid = grids[unit];
  const unitEvents = events[unit];

  function setCell(metric: ShiftMetric, index: number, value: string) {
    setGrids(old => ({ ...old, [unit]: { ...old[unit], [metric]: old[unit][metric].map((v, i) => i === index ? value : v) } }));
  }

  async function saveReadings() {
    setSaving(true); setError(null); setNotice(null);
    try {
      const entries = SHIFT_METRICS.flatMap(m => SHIFT_TIME_SLOTS.map((slot, i) => ({ unit, timeSlot: slot, metric: m.key, value: grid[m.key][i].trim() })));
      const res = await fetch("/api/shift-readings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: operatingDate, entries }) });
      const json = await res.json() as { saved?: number; error?: string };
      if (!res.ok || json.error) throw new Error(json.error || "Không lưu được số liệu.");
      setNotice(`Đã lưu số liệu tổ máy ${unit}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được số liệu.");
    } finally {
      setSaving(false);
    }
  }

  function setTotal(field: keyof TotalsDraft, value: string) {
    setTotals(old => ({ ...old, [unit]: { ...old[unit], [field]: value } }));
  }

  async function saveTotals() {
    setSaving(true); setError(null); setNotice(null);
    try {
      const codes = TOTAL_FIELD_CODES[unit];
      const t = totals[unit];
      const entries = [
        { operatingDate, fieldCode: codes.dauCuc, value: t.dauCuc.trim() },
        { operatingDate, fieldCode: codes.thuongPham, value: t.thuongPham.trim() },
        { operatingDate, fieldCode: codes.thanTieuThu, value: t.thanTieuThu.trim() },
        { operatingDate, fieldCode: codes.thanTonKho, value: t.thanTonKho.trim() },
      ];
      const res = await fetch("/api/daily-inputs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ period: operatingDate.slice(0, 7), entries }) });
      const json = await res.json() as { saved?: number; error?: string };
      if (!res.ok || json.error) throw new Error(json.error || "Không lưu được số liệu tổng ngày.");
      setNotice(`Đã lưu số liệu tổng ngày tổ máy ${unit}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được số liệu tổng ngày.");
    } finally {
      setSaving(false);
    }
  }

  function addEvent() {
    if (!draft.startTime || !draft.description.trim()) { setError("Cần nhập thời gian bắt đầu và mô tả sự kiện."); return; }
    const event: OperatingEvent = { startAt: `${operatingDate} ${draft.startTime}`, endAt: draft.endTime ? `${operatingDate} ${draft.endTime}` : "", eventType: draft.eventType, description: draft.description.trim() };
    setEvents(old => ({ ...old, [unit]: [...old[unit], event].sort((a, b) => a.startAt.localeCompare(b.startAt)) }));
    setDraft(blankEventDraft());
  }

  function removeEvent(index: number) {
    setEvents(old => ({ ...old, [unit]: old[unit].filter((_, i) => i !== index) }));
  }

  async function saveEvents() {
    setSaving(true); setError(null); setNotice(null);
    try {
      const res = await fetch("/api/operating-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: operatingDate, unit, events: unitEvents }) });
      const json = await res.json() as { saved?: number; error?: string };
      if (!res.ok || json.error) throw new Error(json.error || "Không lưu được nhật ký sự kiện.");
      setNotice(`Đã lưu nhật ký sự kiện tổ máy ${unit}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được nhật ký sự kiện.");
    } finally {
      setSaving(false);
    }
  }

  async function exportFile(target: "S1" | "S2" | "A0") {
    setExporting(target); setError(null);
    try {
      const res = await fetch(`/api/bcsx-export?date=${operatingDate}&unit=${target}`);
      if (!res.ok) { const json = await res.json().catch(() => null) as { error?: string } | null; throw new Error(json?.error || "Không xuất được file."); }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = match?.[1] || `BCSX_NMD_${target}_${operatingDate}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xuất được file.");
    } finally {
      setExporting(null);
    }
  }

  const [viewMode, setViewMode] = useState<"3shifts" | "ca1" | "ca2" | "ca3" | "scroll">("3shifts");
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pastedExcelText, setPastedExcelText] = useState("");
  const [pasteTargetStart, setPasteTargetStart] = useState<number>(0);

  const SHIFT_SLICES = useMemo(() => [
    { id: "ca1", label: "Ca 1", hours: "00:30 – 08:00", start: 0, end: 16, headerColor: "bg-[#dcebf5] text-[#173b64] border-blue-200" },
    { id: "ca2", label: "Ca 2", hours: "08:30 – 16:00", start: 16, end: 32, headerColor: "bg-[#dcf5e7] text-[#115e3c] border-emerald-200" },
    { id: "ca3", label: "Ca 3", hours: "16:30 – 23:59", start: 32, end: 47, headerColor: "bg-[#fef3d6] text-[#854d0e] border-amber-200" },
  ] as const, []);

  function applyPastedMatrix(text: string, startSlotIndex: number, startMetricKey: ShiftMetric = "P"): number {
    const rows = text.trim().split(/\r?\n/).map(row => row.split("\t"));
    if (!rows.length) return 0;

    const metricKeys: ShiftMetric[] = ["P", "Q", "D", "E"];
    const startMetricIdx = metricKeys.indexOf(startMetricKey);
    let count = 0;

    setGrids(old => {
      const currentUnitGrid = { ...old[unit] };
      const newGrid: ReadingsGrid = {
        P: [...currentUnitGrid.P],
        Q: [...currentUnitGrid.Q],
        D: [...currentUnitGrid.D],
        E: [...currentUnitGrid.E],
      };

      for (let r = 0; r < rows.length; r++) {
        const targetRowIdx = startSlotIndex + r;
        if (targetRowIdx >= SHIFT_TIME_SLOTS.length) break;

        const rowValues = rows[r];
        for (let c = 0; c < rowValues.length; c++) {
          const targetMetricIdx = startMetricIdx + c;
          if (targetMetricIdx >= metricKeys.length) break;

          const metricKey = metricKeys[targetMetricIdx];
          const val = rowValues[c].trim();
          newGrid[metricKey][targetRowIdx] = val;
          count++;
        }
      }

      return { ...old, [unit]: newGrid };
    });

    return count;
  }

  function handleCellPaste(startMetric: ShiftMetric, startIndex: number, event: React.ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text");
    if (!text || (!text.includes("\t") && !text.includes("\n"))) return;
    event.preventDefault();
    const count = applyPastedMatrix(text, startIndex, startMetric);
    if (count > 0) setNotice(`Đã dán ${count} giá trị từ clipboard vào bảng.`);
  }

  function handleKeyDown(metric: ShiftMetric, index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    const metricKeys: ShiftMetric[] = ["P", "Q", "D", "E"];
    const metricIdx = metricKeys.indexOf(metric);

    if (event.key === "Enter" || event.key === "ArrowDown") {
      event.preventDefault();
      if (index + 1 < SHIFT_TIME_SLOTS.length) {
        const nextInput = document.getElementById(`cell-${metric}-${index + 1}`);
        nextInput?.focus();
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (index - 1 >= 0) {
        const prevInput = document.getElementById(`cell-${metric}-${index - 1}`);
        prevInput?.focus();
      }
    } else if (event.key === "ArrowRight") {
      if (event.currentTarget.selectionStart === event.currentTarget.value.length && metricIdx + 1 < metricKeys.length) {
        event.preventDefault();
        const nextCol = document.getElementById(`cell-${metricKeys[metricIdx + 1]}-${index}`);
        nextCol?.focus();
      }
    } else if (event.key === "ArrowLeft") {
      if (event.currentTarget.selectionStart === 0 && metricIdx - 1 >= 0) {
        event.preventDefault();
        const prevCol = document.getElementById(`cell-${metricKeys[metricIdx - 1]}-${index}`);
        prevCol?.focus();
      }
    }
  }

  function renderShiftTable(startIdx: number, endIdx: number, title?: string, hours?: string, headerClass?: string) {
    const slots = SHIFT_TIME_SLOTS.slice(startIdx, endIdx);
    const needDummyRow = (endIdx - startIdx) < 16;

    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {title && (
          <div className={`flex items-center justify-between border-b px-2.5 py-1.5 ${headerClass || "bg-[#dcebf5] text-[#173b64]"}`}>
            <span className="font-extrabold text-xs tracking-tight">{title}</span>
            {hours && <span className="text-[10px] font-semibold opacity-85">{hours}</span>}
          </div>
        )}
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-100/90 text-[#173b64] text-[10px] font-bold">
              <th className="py-1 px-1 text-center w-[40px]">Giờ</th>
              <th className="py-1 px-0.5 text-center" title="Tổng P (MW) đầu cực máy phát">P cực</th>
              <th className="py-1 px-0.5 text-center" title="Tổng Q (MVAr) đầu cực máy phát">Q cực</th>
              <th className="py-1 px-0.5 text-center" title="Tổng P (MW) điểm bán điện">P bán</th>
              <th className="py-1 px-0.5 text-center" title="Điện áp thanh cái (kV)">U áp</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((slot, offset) => {
              const i = startIdx + offset;
              return (
                <tr key={slot} className="border-t border-slate-100 hover:bg-blue-50/20">
                  <td className="py-0.5 px-1 text-center font-bold text-slate-600 text-[11px] bg-slate-50/60">{slot}</td>
                  {SHIFT_METRICS.map(m => (
                    <td key={m.key} className="p-0.5">
                      <input
                        id={`cell-${m.key}-${i}`}
                        value={grid[m.key][i]}
                        onChange={e => setCell(m.key, i, e.target.value)}
                        onKeyDown={e => handleKeyDown(m.key, i, e)}
                        onPaste={e => handleCellPaste(m.key, i, e)}
                        inputMode="decimal"
                        className="h-6 w-full rounded border border-slate-200 bg-white px-1 text-right font-mono text-[11px] text-black outline-none transition focus:border-[#334785] focus:bg-blue-50/50 focus:ring-1 focus:ring-[#334785]/20"
                        placeholder="—"
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
            {needDummyRow && (
              <tr className="border-t border-slate-100 bg-slate-50/40 text-slate-300">
                <td className="py-0.5 px-1 text-center text-[10px]">—</td>
                <td colSpan={4} className="py-0.5 px-1 text-center text-[10px] italic text-slate-400">Kết thúc 24h</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  const filledCount = useMemo(() => grid.P.filter(v => v.trim() !== "").length, [grid]);

  return <div className="flex flex-col gap-3">
    {/* Header trang tinh gọn */}
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h1 className="text-base font-extrabold text-[#173b64]">Nhập liệu vận hành theo ca — Xuất BCSX NMĐ</h1>
          <p className="text-xs text-slate-500">Nhập 1 lần trên web, xuất lại đúng định dạng file BCSX gửi Điều độ NSMO cho cả 3 tổ máy A0/S1/S2.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-600">Ngày:</span>
          <DateField value={operatingDate} onChange={setOperatingDate} className="w-[145px] h-8 text-xs"/>
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {(["S1", "S2"] as const).map(u => (
              <button key={u} type="button" onClick={() => setUnit(u)} className={`rounded-md px-3 py-1 text-xs font-bold transition ${unit === u ? "bg-[#334785] text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                {u}
              </button>
            ))}
          </div>
        </div>
      </div>
      {error && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600">{error}</p>}
      {notice && <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">{notice}</p>}
      {loading && <p className="mt-1 text-xs text-slate-400">Đang tải dữ liệu ngày…</p>}
    </div>

    {/* 1. Bảng thông số nửa giờ — 3 Ca song song không cần cuộn */}
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#173b64]">
            1. Bảng thông số nửa giờ — tổ máy {unit}
          </h2>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
            {filledCount}/{SHIFT_TIME_SLOTS.length} điểm đã nhập ({Math.round(filledCount / SHIFT_TIME_SLOTS.length * 100)}%)
          </span>
        </div>

        {/* Thanh công cụ: Chế độ xem + Nút dán Excel + Nút Lưu */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setViewMode("3shifts")}
              className={`rounded px-2 py-0.5 font-bold transition ${viewMode === "3shifts" ? "bg-[#334785] text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
              title="Hiển thị 3 ca song song vừa khít màn hình, không cần cuộn"
            >
              3 Ca song song
            </button>
            <button
              type="button"
              onClick={() => setViewMode("ca1")}
              className={`rounded px-2 py-0.5 font-bold transition ${viewMode === "ca1" ? "bg-[#334785] text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              Ca 1
            </button>
            <button
              type="button"
              onClick={() => setViewMode("ca2")}
              className={`rounded px-2 py-0.5 font-bold transition ${viewMode === "ca2" ? "bg-[#334785] text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              Ca 2
            </button>
            <button
              type="button"
              onClick={() => setViewMode("ca3")}
              className={`rounded px-2 py-0.5 font-bold transition ${viewMode === "ca3" ? "bg-[#334785] text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              Ca 3
            </button>
            <button
              type="button"
              onClick={() => setViewMode("scroll")}
              className={`rounded px-2 py-0.5 font-bold transition ${viewMode === "scroll" ? "bg-[#334785] text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
              title="Dạng 1 cột cuộn dọc cổ điển"
            >
              Cuộn dọc
            </button>
          </div>

          <button
            type="button"
            onClick={() => { setPastedExcelText(""); setPasteModalOpen(true); }}
            className="h-7 rounded-lg border border-blue-300 bg-blue-50 px-2.5 text-xs font-bold text-[#334785] shadow-sm hover:bg-blue-100"
            title="Dán nhanh hàng loạt từ bảng tính Excel"
          >
            📋 Dán từ Excel
          </button>

          <button
            type="button"
            disabled={saving || isViewer}
            title={isViewer ? "Tài khoản Chỉ xem không có quyền lưu dữ liệu." : undefined}
            onClick={() => void saveReadings()}
            className="h-7 rounded-lg bg-gradient-to-r from-[#334785] to-[#4c6bbd] px-3.5 text-xs font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
          >
            {saving ? "Đang lưu…" : "Lưu bảng thông số"}
          </button>
        </div>
      </div>

      <p className="mt-1.5 text-[11px] text-slate-500">
        💡 <b>Mẹo nhập nhanh</b>: Bấm <b>Enter</b> hoặc <b>↓</b> để nhảy xuống ô dưới, <b>↑</b> nhảy lên trên, hoặc bấm trực tiếp vào ô rồi ấn <b>Ctrl + V</b> để dán dữ liệu copy từ Excel.
      </p>

      {/* Hiển thị bảng theo chế độ xem */}
      <div className="mt-2">
        {viewMode === "3shifts" ? (
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
            {SHIFT_SLICES.map(slice => (
              <div key={slice.id}>
                {renderShiftTable(slice.start, slice.end, slice.label, slice.hours, slice.headerColor)}
              </div>
            ))}
          </div>
        ) : viewMode === "ca1" ? (
          <div className="max-w-xl mx-auto">
            {renderShiftTable(0, 16, "Ca 1", "00:30 – 08:00", "bg-[#dcebf5] text-[#173b64]")}
          </div>
        ) : viewMode === "ca2" ? (
          <div className="max-w-xl mx-auto">
            {renderShiftTable(16, 32, "Ca 2", "08:30 – 16:00", "bg-[#dcf5e7] text-[#115e3c]")}
          </div>
        ) : viewMode === "ca3" ? (
          <div className="max-w-xl mx-auto">
            {renderShiftTable(32, 47, "Ca 3", "16:30 – 23:59", "bg-[#fef3d6] text-[#854d0e]")}
          </div>
        ) : (
          <div className="max-h-[480px] overflow-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#dcebf5] text-[#173b64]">
                <tr>
                  <th className="p-2 text-center w-[50px]">Thời điểm</th>
                  {SHIFT_METRICS.map(m => <th key={m.key} className="p-2 text-center font-semibold">{m.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {SHIFT_TIME_SLOTS.map((slot, i) => (
                  <tr key={slot} className="border-t border-slate-100 even:bg-slate-50/60">
                    <td className="p-1 pl-2 font-semibold text-slate-600 text-center">{slot}</td>
                    {SHIFT_METRICS.map(m => (
                      <td key={m.key} className="p-0.5">
                        <input
                          id={`cell-${m.key}-${i}`}
                          value={grid[m.key][i]}
                          onChange={e => setCell(m.key, i, e.target.value)}
                          onKeyDown={e => handleKeyDown(m.key, i, e)}
                          onPaste={e => handleCellPaste(m.key, i, e)}
                          inputMode="decimal"
                          className="h-6 w-full rounded border border-slate-200 px-1 text-right font-mono text-xs text-black outline-none focus:border-[#334785]"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>

    {/* Modal Hỗ trợ Dán nhanh từ Excel */}
    {pasteModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h3 className="text-sm font-extrabold text-[#173b64]">📋 Dán nhanh dữ liệu từ Excel vào bảng</h3>
              <p className="mt-0.5 text-xs text-slate-500">Copy vùng dữ liệu trong Excel (P, Q, P bán, U) rồi dán vào ô bên dưới</p>
            </div>
            <button
              type="button"
              onClick={() => setPasteModalOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 space-y-2.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-700">Điền bắt đầu từ:</span>
              <select
                value={pasteTargetStart}
                onChange={e => setPasteTargetStart(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-black"
              >
                <option value={0}>Đầu ngày (00:30)</option>
                <option value={16}>Bắt đầu Ca 2 (08:30)</option>
                <option value={32}>Bắt đầu Ca 3 (16:30)</option>
              </select>
            </div>

            <textarea
              value={pastedExcelText}
              onChange={e => setPastedExcelText(e.target.value)}
              rows={7}
              placeholder="Dán nội dung copy từ Excel vào đây (hỗ trợ cả 4 cột P, Q, P bán, U hoặc 1 cột dọc)..."
              className="w-full resize-y rounded-xl border border-slate-300 bg-[#fbfcfe] p-2.5 font-mono text-xs text-black outline-none focus:border-[#334785] focus:ring-1 focus:ring-[#334785]"
            />
            <p className="text-[11px] text-slate-400">
              * Hệ thống sẽ tự động tách cột theo phím Tab và dòng theo phím Enter để điền chính xác vào bảng.
            </p>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setPasteModalOpen(false)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={!pastedExcelText.trim()}
              onClick={() => {
                const count = applyPastedMatrix(pastedExcelText, pasteTargetStart, "P");
                setPasteModalOpen(false);
                setNotice(`Đã điền thành công ${count} giá trị vào bảng thông số.`);
              }}
              className="rounded-lg bg-gradient-to-r from-[#334785] to-[#4c6bbd] px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
            >
              Áp dụng vào bảng
            </button>
          </div>
        </div>
      </div>
    )}

    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-[#173b64]">2. Số liệu tổng ngày — tổ máy {unit}</h2>
        <button type="button" disabled={saving || isViewer} title={isViewer ? "Tài khoản Chỉ xem không có quyền lưu dữ liệu." : undefined} onClick={() => void saveTotals()} className="rounded-lg bg-[#334785] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Đang lưu…" : "Lưu số liệu tổng ngày"}</button>
      </div>
      <p className="mt-1 text-sm text-slate-500">Các ô này dùng chung với đồng bộ QLKT ở trang <Link href="/" className="font-semibold text-[#334785] underline">Dữ liệu các tháng</Link> — đồng bộ bên đó hoặc nhập tay ở đây đều được, số sẽ khớp nhau. Đang chờ người dùng chỉ vị trí chính xác trên QLKT để nối đồng bộ trực tiếp ngay tại trang này.</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="flex flex-col text-xs font-semibold text-slate-500">Sản lượng đầu cực (MWh)<input value={totals[unit].dauCuc} onChange={e => setTotal("dauCuc", e.target.value)} inputMode="decimal" className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-right text-black"/></label>
        <label className="flex flex-col text-xs font-semibold text-slate-500">Sản lượng thương phẩm (MWh)<input value={totals[unit].thuongPham} onChange={e => setTotal("thuongPham", e.target.value)} inputMode="decimal" className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-right text-black"/></label>
        <label className="flex flex-col text-xs font-semibold text-slate-500">Than tiêu thụ (tấn)<input value={totals[unit].thanTieuThu} onChange={e => setTotal("thanTieuThu", e.target.value)} inputMode="decimal" className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-right text-black"/></label>
        <label className="flex flex-col text-xs font-semibold text-slate-500">Than tồn kho (tấn, toàn nhà máy)<input value={totals[unit].thanTonKho} onChange={e => setTotal("thanTonKho", e.target.value)} inputMode="decimal" className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-right text-black"/></label>
      </div>
      <p className="mt-2 text-xs text-slate-400">Sản lượng tự dùng = đầu cực − thương phẩm, tự tính khi xuất file, không cần nhập.</p>
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-extrabold text-[#173b64]">3. Tình hình vận hành (nhật ký sự kiện) — tổ máy {unit}</h2>
      <p className="mt-1 text-sm text-slate-500">Sẽ đồng bộ trực tiếp từ QLKT khi có vị trí cụ thể — hiện có thể nhập tay tạm thời ở đây.</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs font-semibold text-slate-500">Bắt đầu<input type="time" value={draft.startTime} onChange={e => setDraft(d => ({ ...d, startTime: e.target.value }))} className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-black"/></label>
        <label className="flex flex-col text-xs font-semibold text-slate-500">Kết thúc<input type="time" value={draft.endTime} onChange={e => setDraft(d => ({ ...d, endTime: e.target.value }))} className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-black"/></label>
        <label className="flex flex-col text-xs font-semibold text-slate-500">Loại sự kiện<select value={draft.eventType} onChange={e => setDraft(d => ({ ...d, eventType: Number(e.target.value) }))} className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-black">{EVENT_TYPES.map(t => <option key={t.code} value={t.code}>{t.code} — {t.label}</option>)}</select></label>
        <label className="flex min-w-[220px] flex-1 flex-col text-xs font-semibold text-slate-500">Mô tả<input value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} placeholder="Ví dụ: Tăng tải S1 từ 435.7MW lên 536MW" className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-black"/></label>
        <button type="button" onClick={addEvent} className="rounded-lg border border-[#334785] px-3 py-2 text-sm font-bold text-[#334785]">+ Thêm dòng</button>
      </div>
      <div className="mt-3 overflow-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-[#dcebf5] text-[#173b64]"><tr><th className="p-2 text-left">Bắt đầu</th><th className="p-2 text-left">Kết thúc</th><th className="p-2 text-center">Loại</th><th className="p-2 text-left">Sự kiện</th><th className="p-2"></th></tr></thead>
          <tbody>{unitEvents.map((e, i) => <tr key={i} className="border-t border-slate-100"><td className="p-2 text-black">{e.startAt.slice(11)}</td><td className="p-2 text-black">{e.endAt.slice(11)}</td><td className="p-2 text-center text-black">{e.eventType}</td><td className="p-2 text-black">{e.description}</td><td className="p-2 text-right"><button type="button" onClick={() => removeEvent(i)} className="text-xs font-bold text-red-500">Xóa</button></td></tr>)}
          {unitEvents.length === 0 && <tr><td colSpan={5} className="p-3 text-center text-slate-400">Chưa có sự kiện nào trong ngày.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex justify-end"><button type="button" disabled={saving || isViewer} title={isViewer ? "Tài khoản Chỉ xem không có quyền lưu dữ liệu." : undefined} onClick={() => void saveEvents()} className="rounded-lg bg-[#334785] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Đang lưu…" : "Lưu nhật ký sự kiện"}</button></div>
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-extrabold text-[#173b64]">4. Xuất file BCSX_NMD</h2>
      <p className="mt-1 text-sm text-slate-500">Xuất đúng định dạng file mẫu gốc, đã điền số liệu — nhớ Lưu bảng thông số, Lưu số liệu tổng ngày và Lưu nhật ký sự kiện trước khi xuất. File A0 tự tính = tổng S1+S2 tại từng ô, nhật ký sự kiện A0 xếp các dòng của S1 trước rồi đến S2.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["A0", "S1", "S2"] as const).map(target => <button key={target} type="button" disabled={exporting !== null} onClick={() => void exportFile(target)} className="rounded-lg border border-[#334785] bg-white px-4 py-2 text-sm font-bold text-[#334785] disabled:opacity-50">{exporting === target ? "Đang xuất…" : `Xuất BCSX_NMD_${target}`}</button>)}
      </div>
    </div>
  </div>;
}
