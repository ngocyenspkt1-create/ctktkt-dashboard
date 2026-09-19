"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Save, Search } from "lucide-react";
import { DateField } from "@/components/ui/date-field";
import { useSessionUser } from "@/components/session-context";
import { hasPermission } from "@/lib/auth/session";
import { CTKTKT_BCSX_LINKED_CELLS, CTKTKT_BCSX_LINKS } from "@/lib/ctktkt-bcsx-link";
import { calculateCtktktSummary, previousIsoDate, type CtktktDayEntries, type CtktktKpis } from "@/lib/ctktkt-report";
import { CTKTKT_INPUT_FIELDS } from "@/lib/ctktkt-fields.generated";

type LoadedEntry = { operatingDate: string; cell: string; value: string };
type LinkWarning = { operatingDate: string; cell: string; message: string };
type SectionKey = (typeof CTKTKT_INPUT_FIELDS)[number]["section"];
type DisplayField = { cell: string; section: SectionKey; sectionLabel: string; label: string; row: number; column: number };

const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const sectionOrder: SectionKey[] = ["power_meters", "fuel_meters", "water_oil", "environment", "coal_quality", "pmis_daily", "pmis_02pd"];
const editableFields = CTKTKT_INPUT_FIELDS.filter(field => !CTKTKT_BCSX_LINKED_CELLS.has(field.cell));
const displayFields: DisplayField[] = [
  ...editableFields,
  ...CTKTKT_BCSX_LINKS.map(link => ({
    cell: link.cell,
    section: link.section,
    sectionLabel: link.sectionLabel,
    label: link.label,
    row: Number(link.cell.match(/\d+$/)?.[0] || 0),
    column: link.cell.charCodeAt(0) - 64,
  })),
].sort((a, b) => a.row - b.row || a.column - b.column);
const numberFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 });
const metricRows: Array<{ key: keyof CtktktKpis; label: string; unit: string }> = [
  { key: "grossMwh", label: "Điện đầu cực", unit: "MWh" },
  { key: "netMwh", label: "Điện giao", unit: "MWh" },
  { key: "auxiliaryMwh", label: "Điện tự dùng", unit: "MWh" },
  { key: "auxiliaryPercent", label: "Tỷ lệ tự dùng gồm tổn thất MBA", unit: "%" },
  { key: "rawCoalTonnes", label: "Than chưa quy ẩm", unit: "tấn" },
  { key: "adjustedCoalTonnes", label: "Than quy ẩm 8,5%", unit: "tấn" },
  { key: "netCoalRate", label: "Suất hao than tinh", unit: "g/kWh" },
  { key: "netHeatRate", label: "Suất hao nhiệt tinh", unit: "kJ/kWh" },
];

function format(value: number | null) {
  return value === null || !Number.isFinite(value) ? "—" : numberFormat.format(value);
}

export function CtktktReport() {
  const user = useSessionUser();
  const canEdit = hasPermission(user, "edit_daily_inputs");
  const [date, setDate] = useState(today);
  const [byDate, setByDate] = useState<Record<string, CtktktDayEntries>>({});
  const [linkedByDate, setLinkedByDate] = useState<Record<string, CtktktDayEntries>>({});
  const [linkWarnings, setLinkWarnings] = useState<LinkWarning[]>([]);
  const [section, setSection] = useState<SectionKey>("power_meters");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const period = date.slice(0, 7);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/ctktkt-report?period=${encodeURIComponent(period)}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const body = await response.json() as { entries?: LoadedEntry[]; linkedEntries?: LoadedEntry[]; warnings?: LinkWarning[]; error?: string };
        if (!response.ok) throw new Error(body.error || "Không tải được dữ liệu.");
        const next: Record<string, CtktktDayEntries> = {};
        for (const entry of body.entries || []) {
          next[entry.operatingDate] ||= {};
          next[entry.operatingDate][entry.cell] = entry.value;
        }
        const nextLinked: Record<string, CtktktDayEntries> = {};
        for (const entry of body.linkedEntries || []) {
          nextLinked[entry.operatingDate] ||= {};
          nextLinked[entry.operatingDate][entry.cell] = entry.value;
        }
        setByDate(next);
        setLinkedByDate(nextLinked);
        setLinkWarnings(body.warnings || []);
      })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Không tải được dữ liệu."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [period]);

  const current = useMemo(() => ({ ...(byDate[date] || {}), ...(linkedByDate[date] || {}) }), [byDate, linkedByDate, date]);
  const previousDate = previousIsoDate(date);
  const previous = useMemo(() => {
    const manual = byDate[previousDate];
    const linked = linkedByDate[previousDate];
    return manual || linked ? { ...(manual || {}), ...(linked || {}) } : undefined;
  }, [byDate, linkedByDate, previousDate]);
  const selectedWarnings = useMemo(() => linkWarnings.filter(item => item.operatingDate === date), [linkWarnings, date]);
  const linkedCount = Object.keys(linkedByDate[date] || {}).length;
  const hasPreviousManualData = Boolean(byDate[previousDate]);
  const summary = useMemo(() => calculateCtktktSummary(current, previous), [current, previous]);
  const sections = useMemo(() => sectionOrder.map(key => {
    const first = displayFields.find(field => field.section === key);
    return { key, label: first?.sectionLabel || key, count: displayFields.filter(field => field.section === key).length };
  }), []);
  const fields = useMemo(() => displayFields.filter(field => field.section === section && (!search.trim() || `${field.label} ${field.cell}`.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi")))), [section, search]);

  const update = (cell: string, value: string) => {
    setByDate(old => ({ ...old, [date]: { ...(old[date] || {}), [cell]: value } }));
    setDirty(true); setMessage(""); setError("");
  };

  const save = async () => {
    if (!canEdit) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/ctktkt-report", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operatingDate: date, entries: editableFields.map(field => ({ cell: field.cell, value: current[field.cell] || "" })) }),
      });
      const body = await response.json() as { saved?: number; error?: string };
      if (!response.ok) throw new Error(body.error || "Không lưu được dữ liệu.");
      setDirty(false); setMessage(`Đã lưu ${body.saved || 0} ô nhập tay của ngày ${date.split("-").reverse().join("/")}.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không lưu được dữ liệu."); }
    finally { setSaving(false); }
  };

  return <section className="mx-auto grid max-w-[1550px] gap-4">
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#5268b7]">Báo cáo gốc · tự tính theo công thức</p><h1 className="mt-1 text-2xl font-extrabold text-[#173b64]">Chỉ tiêu kinh tế kỹ thuật NMNĐ Duyên Hải 1</h1><p className="mt-1 max-w-4xl text-sm text-slate-600">Chỉ nhập các ô thủ công; số điện, than quy ẩm, suất hao than và suất hao nhiệt được tính trực tiếp từ chỉ số công tơ với toàn bộ độ chính xác.</p></div>
        <div className="flex flex-wrap items-end gap-2"><label className="grid gap-1 text-xs font-bold text-slate-600">Ngày vận hành<DateField value={date} onChange={value => { if (dirty && !window.confirm("Ngày hiện tại có thay đổi chưa lưu. Chuyển ngày và bỏ các thay đổi này?")) return; if (value.slice(0, 7) !== period) setLoading(true); setDate(value); setDirty(false); setMessage(""); setError(""); }} className="w-44"/></label><button type="button" onClick={save} disabled={!canEdit || saving || loading || !dirty} className="flex h-10 items-center gap-2 rounded-xl bg-[#4057b5] px-4 text-sm font-bold text-white shadow-sm disabled:opacity-45"><Save className="size-4"/>{saving ? "Đang lưu…" : "Lưu ngày"}</button><a href={`/api/ctktkt-report/export?period=${encodeURIComponent(period)}`} className="flex h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white shadow-sm"><Download className="size-4"/>Xuất Excel tháng</a></div>
      </div>
      {!hasPreviousManualData && !loading && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Chưa có chỉ số ngày trước ({previousDate}), nên các giá trị tính theo chênh lệch công tơ tạm hiển thị “—”. Hãy nhập ngày trước trước khi chốt báo cáo.</p>}
      {!loading && <p className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900"><b>Liên kết BCSX mục 1:</b> đã lấy {linkedCount}/42 ô tại các mốc 06h, 10h, 14h, 18h, 22h và 24h. Các ô này chỉ sửa tại trang BCSX để hai báo cáo luôn dùng cùng một số liệu.</p>}
      {selectedWarnings.map(item => <p key={`${item.cell}-${item.message}`} role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{item.message}</p>)}
      {error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{message}</p>}
    </div>

    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b bg-[#f8faff] px-4 py-3"><h2 className="font-extrabold text-[#173b64]">Kết quả tính tự động</h2><p className="text-xs text-slate-500">Nền xanh: công thức khóa, không nhập tay. Kết quả chỉ xuất hiện khi đủ chỉ số đầu–cuối và dữ liệu than theo ca.</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="bg-[#dcebf5] text-[#173b64]"><th className="p-2 text-left">Chỉ tiêu</th><th className="p-2 text-right">S1</th><th className="p-2 text-right">S2</th><th className="p-2 text-right">Nhà máy</th><th className="p-2 text-center">Đơn vị</th></tr></thead><tbody>{metricRows.map(row => <tr key={row.key} className="border-t"><td className="p-2 font-semibold text-slate-700">{row.label}</td>{([summary.s1, summary.s2, summary.plant] as CtktktKpis[]).map((item, index) => <td key={index} className="bg-cyan-50/60 p-2 text-right font-bold tabular-nums text-[#173b64]">{format(item[row.key])}</td>)}<td className="p-2 text-center text-slate-500">{row.unit}</td></tr>)}</tbody></table></div>
      <div className="grid gap-2 border-t bg-white p-3 text-xs text-slate-600 md:grid-cols-2 xl:grid-cols-4"><p><b>Điện:</b> chỉ số 24h ngày D trừ 24h ngày D−1.</p><p><b>Than:</b> tổng 12 cân, tách 3 ca theo 08h/16h/24h.</p><p><b>Quy ẩm:</b> m × (1−W/100) / (1−8,5%).</p><p><b>Suất hao nhiệt:</b> suất hao than tinh × HHV / 1000.</p></div>
    </div>

    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3"><div><h2 className="font-extrabold text-[#173b64]">Dữ liệu nguồn theo file gốc</h2><p className="text-xs text-slate-500">Ô vàng nhập tại đây; ô xanh tự lấy từ BCSX mục 1. Mã ô Excel được giữ để đối chiếu và xuất đúng vị trí.</p></div><label className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm"><Search className="size-4 text-slate-400"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm tên hoặc mã ô…" className="w-56 outline-none"/></label></div>
      <div className="flex gap-2 overflow-x-auto border-b bg-[#f8fafc] p-2">{sections.map(item => <button key={item.key} type="button" onClick={() => setSection(item.key)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold ${section === item.key ? "bg-[#4057b5] text-white" : "border border-slate-200 bg-white text-slate-600"}`}>{item.label} ({item.count})</button>)}</div>
      <div className="grid max-h-[620px] gap-2 overflow-y-auto p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{fields.map(field => {
        const linked = CTKTKT_BCSX_LINKED_CELLS.has(field.cell);
        return <label key={field.cell} className={`grid gap-1 rounded-xl border p-2 text-xs font-semibold text-slate-700 ${linked ? "border-blue-200 bg-blue-50/60" : "border-amber-200 bg-amber-50/50"}`}><span className="min-h-8 leading-4">{field.label}{linked && <small className="ml-1 rounded bg-blue-100 px-1.5 py-0.5 font-bold text-blue-800">Từ BCSX</small>}</span><span className="flex items-center gap-2"><code className={`rounded bg-white px-1.5 py-1 text-[11px] font-bold ${linked ? "text-blue-800" : "text-amber-800"}`}>{field.cell}</code><input disabled={linked || !canEdit || loading} inputMode={field.cell === "T181" ? "text" : "decimal"} value={current[field.cell] || ""} onChange={event => update(field.cell, event.target.value)} className={`h-8 min-w-0 flex-1 rounded-lg border bg-white px-2 text-right text-sm font-normal tabular-nums text-black outline-none focus:border-[#4057b5] focus:ring-2 focus:ring-[#4057b5]/20 disabled:bg-slate-100 ${linked ? "border-blue-200" : "border-amber-200"}`}/></span></label>;
      })}</div>
      <div className="border-t bg-[#fffbeb] px-4 py-2 text-xs text-amber-900">{editableFields.length} ô còn nhập tay; 42 ô P/Q/P điểm bán điện/điện áp đã liên kết từ BCSX mục 1. Các ô công thức không cho sửa trên web; file xuất yêu cầu Excel tính lại khi mở.</div>
    </div>

    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><p className="font-extrabold">Cảnh báo từ file nguồn</p><p className="mt-1">File gốc có các công thức <code>#REF!</code> và liên kết ngoài dạng <code>[2]16</code>. Hệ thống không dùng các lỗi này để tính KPI trên web; chúng được giữ trong mẫu xuất để dễ truy vết và sẽ được xử lý riêng sau khi xác nhận nguồn đúng của các chỉ tiêu tro xỉ/phân tích than.</p></div>
  </section>;
}
