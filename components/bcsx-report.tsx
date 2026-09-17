"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DateField } from "@/components/ui/date-field";
import { EVENT_TYPES, SHIFT_METRICS, SHIFT_TIME_SLOTS, type OperatingEvent, type ShiftMetric } from "@/lib/bcsx";

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

  const filledCount = useMemo(() => grid.P.filter(v => v.trim() !== "").length, [grid]);

  return <div className="flex flex-col gap-4">
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold text-[#173b64]">Nhập liệu vận hành theo ca — Xuất BCSX NMĐ</h1>
          <p className="mt-1 text-sm text-slate-500">Nhập 1 lần trên web, xuất lại đúng định dạng file BCSX gửi Điều độ NSMO cho cả 3 tổ máy A0/S1/S2.</p>
        </div>
        <div className="flex items-center gap-2">
          <DateField value={operatingDate} onChange={setOperatingDate} className="w-[160px]"/>
          <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {(["S1", "S2"] as const).map(u => <button key={u} type="button" onClick={() => setUnit(u)} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${unit === u ? "bg-[#334785] text-white shadow" : "text-slate-500"}`}>{u}</button>)}
          </div>
        </div>
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{error}</p>}
      {notice && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{notice}</p>}
      {loading && <p className="mt-3 text-sm text-slate-400">Đang tải…</p>}
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-[#173b64]">1. Bảng thông số nửa giờ — tổ máy {unit} ({filledCount}/{SHIFT_TIME_SLOTS.length} điểm đã nhập)</h2>
        <button type="button" disabled={saving} onClick={() => void saveReadings()} className="rounded-lg bg-[#334785] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Đang lưu…" : "Lưu bảng thông số"}</button>
      </div>
      <div className="mt-3 max-h-[420px] overflow-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="sticky top-0 bg-[#dcebf5] text-[#173b64]">
            <tr>
              <th className="p-2 text-left">Thời điểm</th>
              {SHIFT_METRICS.map(m => <th key={m.key} className="p-2 text-center font-semibold">{m.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {SHIFT_TIME_SLOTS.map((slot, i) => <tr key={slot} className="border-t border-slate-100 even:bg-slate-50/60">
              <td className="p-1.5 pl-2 font-semibold text-slate-600">{slot}</td>
              {SHIFT_METRICS.map(m => <td key={m.key} className="p-1">
                <input value={grid[m.key][i]} onChange={e => setCell(m.key, i, e.target.value)} inputMode="decimal" className="w-full rounded-md border border-slate-200 px-2 py-1 text-right text-black outline-none focus:border-[#334785]"/>
              </td>)}
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-[#173b64]">2. Số liệu tổng ngày — tổ máy {unit}</h2>
        <button type="button" disabled={saving} onClick={() => void saveTotals()} className="rounded-lg bg-[#334785] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Đang lưu…" : "Lưu số liệu tổng ngày"}</button>
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
      <div className="mt-3 flex justify-end"><button type="button" disabled={saving} onClick={() => void saveEvents()} className="rounded-lg bg-[#334785] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Đang lưu…" : "Lưu nhật ký sự kiện"}</button></div>
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
