"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, LayoutGrid, Maximize2, Minimize2, Rows3, Save, Search, TableProperties } from "lucide-react";
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
type ViewMode = "dense" | "matrix" | "cards";

const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const sectionOrder: SectionKey[] = ["power_meters", "fuel_meters", "water_oil", "environment", "coal_quality", "pmis_daily", "pmis_02pd"];

const sectionLabelsShort: Record<SectionKey, string> = {
  power_meters: "Điện & Công suất",
  fuel_meters: "Than & Dầu",
  water_oil: "Nước & Hơi",
  environment: "Demin & Khí",
  coal_quality: "Chất lượng than",
  pmis_daily: "PMIS ngày",
  pmis_02pd: "PMIS 02-PĐ",
};

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

// Bổ sung hậu tố tổ máy (S1/S2) dựa theo cột Excel nếu nhãn gốc chưa có
function getFieldDisplayLabel(field: DisplayField): string {
  if (field.column && !field.label.includes("S1") && !field.label.includes("S2")) {
    if (field.column >= 23 && field.column <= 28) return `${field.label} (S1)`;
    if (field.column >= 33 && field.column <= 38) return `${field.label} (S2)`;
  }
  return field.label;
}

// Phân tích nhãn trường để gom nhóm theo mốc giờ hoặc ca
function parseFieldInfo(field: DisplayField) {
  const displayLabel = getFieldDisplayLabel(field);
  if (displayLabel.includes(" · ")) {
    const parts = displayLabel.split(" · ");
    const last = parts[parts.length - 1].trim();
    if (/^\d+$/.test(last) || /^(ca sáng|ca chiều|ca đêm|hòa lưới|2c)$/i.test(last)) {
      const base = parts.slice(0, -1).join(" · ").trim();
      const col = /^\d+$/.test(last) ? (last.length === 1 ? `0${last}:00` : `${last}:00`) : last;
      return { base, col, field, displayLabel };
    }
    if (/^(slđc|slxt)$/i.test(parts[0].trim())) {
      return { base: parts.slice(1).join(" · ").trim(), col: parts[0].trim(), field, displayLabel };
    }
  }
  return { base: displayLabel, col: "", field, displayLabel };
}

function sortColKeys(a: string, b: string) {
  const numA = parseInt(a.replace(/\D/g, ""), 10);
  const numB = parseInt(b.replace(/\D/g, ""), 10);
  if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
  const shiftOrder: Record<string, number> = { "ca sáng": 1, "ca chiều": 2, "ca đêm": 3 };
  const sA = shiftOrder[a.toLowerCase()] || 99;
  const sB = shiftOrder[b.toLowerCase()] || 99;
  return sA - sB || a.localeCompare(b);
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

  // Tùy chỉnh chế độ hiển thị & khung cuộn (Lưới siêu gọn, Bảng ma trận, Thẻ gọn)
  const [viewMode, setViewMode] = useState<ViewMode>("dense");
  const [isExpandedHeight, setIsExpandedHeight] = useState(false);
  const [isKpiCollapsed, setIsKpiCollapsed] = useState(false);

  const period = date.slice(0, 7);

  useEffect(() => {
    const savedMode = localStorage.getItem("ctktkt_view_mode") as ViewMode | null;
    if (savedMode && ["dense", "matrix", "cards"].includes(savedMode)) {
      setViewMode(savedMode);
    }
    const savedExp = localStorage.getItem("ctktkt_expanded_height");
    if (savedExp === "true") setIsExpandedHeight(true);
  }, []);

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("ctktkt_view_mode", mode);
  };

  const toggleExpandedHeight = () => {
    setIsExpandedHeight(prev => {
      const next = !prev;
      localStorage.setItem("ctktkt_expanded_height", String(next));
      return next;
    });
  };

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
    return {
      key,
      label: first?.sectionLabel || key,
      shortLabel: sectionLabelsShort[key] || key,
      count: displayFields.filter(field => field.section === key).length,
    };
  }), []);

  const fields = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("vi");
    return displayFields.filter(field => {
      const matchSection = field.section === section;
      if (!q) return matchSection;
      const displayLabel = getFieldDisplayLabel(field);
      const matchQuery = `${displayLabel} ${field.cell}`.toLocaleLowerCase("vi").includes(q);
      return matchSection && matchQuery;
    });
  }, [section, search]);

  const enteredSectionCount = useMemo(() => {
    return fields.filter(f => current[f.cell] && current[f.cell].trim() !== "").length;
  }, [fields, current]);

  // Gom nhóm dữ liệu cho chế độ Bảng ma trận
  const { matrixTables, matrixSingles } = useMemo(() => {
    const rowMap = new Map<string, Array<{ col: string; field: DisplayField; displayLabel: string }>>();
    fields.forEach(field => {
      const p = parseFieldInfo(field);
      if (!rowMap.has(p.base)) rowMap.set(p.base, []);
      rowMap.get(p.base)!.push(p);
    });

    // Gom các hàng có cùng tập hợp cột vào chung một bảng
    const tablesMap = new Map<string, { columns: string[]; rows: Array<{ base: string; items: Array<{ col: string; field: DisplayField }> }> }>();
    const singles: DisplayField[] = [];

    for (const [base, items] of rowMap) {
      if (items.length > 1) {
        const uniqueCols = Array.from(new Set(items.map(i => i.col))).sort(sortColKeys);
        const colSignature = uniqueCols.join("|");
        if (!tablesMap.has(colSignature)) {
          tablesMap.set(colSignature, { columns: uniqueCols, rows: [] });
        }
        tablesMap.get(colSignature)!.rows.push({ base, items });
      } else {
        singles.push(items[0].field);
      }
    }

    const tables = Array.from(tablesMap.values());
    return { matrixTables: tables, matrixSingles: singles };
  }, [fields]);

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

  return (
    <section className="mx-auto grid w-full min-w-0 max-w-full gap-3 xl:max-w-[1550px]">
      {/* 1. Thanh tiêu đề và công cụ lưu / chọn ngày */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-indigo-800 uppercase">
                Báo cáo gốc · Tự tính theo công thức
              </span>
              <span className="text-xs text-slate-400">|</span>
              <span className="text-xs font-semibold text-slate-500">
                PXVH1 · {displayFields.length} thông số
              </span>
            </div>
            <h1 className="mt-1 text-xl font-black text-[#173b64]">
              Chỉ tiêu kinh tế kỹ thuật NMNĐ Duyên Hải 1
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <span>Ngày:</span>
              <DateField
                value={date}
                onChange={value => {
                  if (dirty && !window.confirm("Ngày hiện tại có thay đổi chưa lưu. Chuyển ngày và bỏ các thay đổi này?")) return;
                  if (value.slice(0, 7) !== period) setLoading(true);
                  setDate(value);
                  setDirty(false);
                  setMessage("");
                  setError("");
                }}
                className="w-36"
              />
            </label>

            <button
              type="button"
              onClick={save}
              disabled={!canEdit || saving || loading || !dirty}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-[#4057b5] px-3.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-[#334694] disabled:opacity-45"
            >
              <Save className="size-3.5" />
              {saving ? "Đang lưu…" : "Lưu ngày"}
            </button>

            <a
              href={`/api/ctktkt-report/export?period=${encodeURIComponent(period)}`}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-emerald-800"
            >
              <Download className="size-3.5" />
              Xuất Excel tháng
            </a>
          </div>
        </div>

        {!hasPreviousManualData && !loading && (
          <p className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
            Chưa có chỉ số ngày trước ({previousDate}), nên các giá trị tính theo chênh lệch công tơ tạm hiển thị “—”. Hãy nhập ngày trước trước khi chốt báo cáo.
          </p>
        )}
        {!loading && (
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs text-blue-900">
            <span>
              <b>Liên kết BCSX mục 1:</b> Đã lấy <b>{linkedCount}/42 ô</b> (06h, 10h, 14h, 18h, 22h, 24h). Sửa tại trang BCSX để hai báo cáo luôn khớp số liệu.
            </span>
            <span className="text-[11px] font-semibold text-blue-700">
              (Ô xanh: Tự lấy BCSX · Ô trắng: Nhập tay)
            </span>
          </div>
        )}
        {selectedWarnings.map(item => (
          <p key={`${item.cell}-${item.message}`} role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-800">
            {item.message}
          </p>
        ))}
        {error && (
          <p role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-800">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900">
            {message}
          </p>
        )}
      </div>

      {/* 2. Bảng kết quả tính tự động KPI (Có nút thu gọn để tiết kiệm chiều cao) */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between border-b bg-[#f8faff] px-3.5 py-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-black text-[#173b64]">Kết quả tính tự động</h2>
            <span className="text-[11px] text-slate-500">
              (Công thức khóa · Tự tính từ công tơ & than theo ca)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsKpiCollapsed(prev => !prev)}
            className="rounded-lg px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-200/60"
          >
            {isKpiCollapsed ? "Mở rộng bảng KPI ▼" : "Thu gọn KPI ▲"}
          </button>
        </div>

        {!isKpiCollapsed ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-[#e9f2fa] text-[#173b64]">
                    <th className="p-1.5 text-left font-bold">Chỉ tiêu</th>
                    <th className="p-1.5 text-right font-bold">Tổ máy S1</th>
                    <th className="p-1.5 text-right font-bold">Tổ máy S2</th>
                    <th className="p-1.5 text-right font-bold">Toàn Nhà máy</th>
                    <th className="p-1.5 text-center font-bold">Đơn vị</th>
                  </tr>
                </thead>
                <tbody>
                  {metricRows.map(row => (
                    <tr key={row.key} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="p-1.5 font-medium text-slate-700">{row.label}</td>
                      {([summary.s1, summary.s2, summary.plant] as CtktktKpis[]).map((item, index) => (
                        <td key={index} className="bg-cyan-50/40 p-1.5 text-right font-bold tabular-nums text-[#173b64]">
                          {format(item[row.key])}
                        </td>
                      ))}
                      <td className="p-1.5 text-center text-slate-500">{row.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-1 border-t bg-[#fafbfc] px-3 py-1.5 text-[11px] text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
              <span><b>Điện:</b> 24h ngày D − 24h ngày D−1</span>
              <span><b>Than:</b> 12 cân (Ca 1/Ca 2/Ca 3)</span>
              <span><b>Quy ẩm:</b> m × (1−W/100) / (1−8,5%)</span>
              <span><b>Suất hao nhiệt:</b> suất hao than × HHV / 1000</span>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-slate-50/60 px-3 py-1.5 text-[11px]">
            <span className="font-semibold text-slate-700">
              Điện đầu cực: <b className="text-[#173b64]">S1 {format(summary.s1.grossMwh)}</b> / <b className="text-[#173b64]">S2 {format(summary.s2.grossMwh)} MWh</b>
            </span>
            <span className="font-semibold text-slate-700">
              Than quy ẩm: <b className="text-[#173b64]">{format(summary.plant.adjustedCoalTonnes)} tấn</b>
            </span>
            <span className="font-semibold text-slate-700">
              Suất hao than: <b className="text-[#173b64]">{format(summary.plant.netCoalRate)} g/kWh</b>
            </span>
            <span className="font-semibold text-slate-700">
              Suất hao nhiệt: <b className="text-[#173b64]">{format(summary.plant.netHeatRate)} kJ/kWh</b>
            </span>
          </div>
        )}
      </div>

      {/* 3. VÙNG DỮ LIỆU NHẬP NGUỒN — ĐÃ TỐI ƯU GỌN VỪA ĐỦ NHẬP, KHÔNG CUỘN NGANG */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {/* Toolbar điều khiển: Chuyển chế độ xem, Tìm kiếm, Đếm tiến độ, Phóng to chiều cao */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b p-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-black text-[#173b64]">
              Dữ liệu nguồn theo file gốc
            </h2>
            <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
              <span>Đã nhập:</span>
              <span className="text-indigo-700">{enteredSectionCount}/{fields.length} ô</span>
              <span className="text-slate-400">({fields.length ? Math.round((enteredSectionCount / fields.length) * 100) : 0}%)</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Thanh tìm kiếm */}
            <label className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 text-xs text-slate-600 focus-within:border-indigo-500 focus-within:bg-white">
              <Search className="size-3.5 text-slate-400" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Tìm tên hoặc mã ô (M3, W8...)"
                className="w-44 bg-transparent outline-none"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-700">
                  ✕
                </button>
              )}
            </label>

            {/* Bộ chuyển đổi chế độ xem: Lưới siêu gọn / Bảng ma trận / Thẻ gọn */}
            <div className="flex rounded-lg bg-slate-100 p-0.5">
              <button
                type="button"
                onClick={() => changeViewMode("dense")}
                title="Lưới ô siêu gọn: hiển thị 60–80 ô cùng lúc trên 1 màn hình"
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${
                  viewMode === "dense"
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-600 hover:text-black"
                }`}
              >
                <Rows3 className="size-3.5" />
                <span>Lưới siêu gọn</span>
              </button>
              <button
                type="button"
                onClick={() => changeViewMode("matrix")}
                title="Bảng ma trận: gom hàng theo các mốc giờ 06h, 10h, 14h, 18h, 22h, 24h"
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${
                  viewMode === "matrix"
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-600 hover:text-black"
                }`}
              >
                <TableProperties className="size-3.5" />
                <span>Bảng ma trận</span>
              </button>
              <button
                type="button"
                onClick={() => changeViewMode("cards")}
                title="Thẻ gọn: bố cục 2 dòng mỗi ô"
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${
                  viewMode === "cards"
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-600 hover:text-black"
                }`}
              >
                <LayoutGrid className="size-3.5" />
                <span>Thẻ gọn</span>
              </button>
            </div>

            {/* Nút bật tắt mở rộng chiều cao khung cuộn */}
            <button
              type="button"
              onClick={toggleExpandedHeight}
              title={isExpandedHeight ? "Thu gọn lại khung cuộn cố định" : "Mở rộng toàn màn hình không giới hạn chiều cao"}
              className={`flex h-8 items-center gap-1 rounded-lg border px-2 text-[11px] font-bold ${
                isExpandedHeight
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {isExpandedHeight ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
              <span className="hidden sm:inline">{isExpandedHeight ? "Thu khung" : "Mở rộng"}</span>
            </button>
          </div>
        </div>

        {/* Thanh chuyển Tab các nhóm phân hệ — Dùng flex-wrap KHÔNG để cuộn ngang */}
        <div className="flex flex-wrap items-center gap-1.5 border-b bg-[#f8fafc] p-2">
          {sections.map(item => {
            const isCurrent = section === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setSection(item.key)}
                title={item.label}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  isCurrent
                    ? "bg-[#4057b5] text-white shadow-xs"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span>{item.shortLabel}</span>
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                  isCurrent ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}>
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* THÂN VÙNG NHẬP LIỆU: Tùy theo ViewMode */}
        <div className={`p-2.5 transition-all ${isExpandedHeight ? "min-h-[400px]" : "max-h-[580px] overflow-y-auto"}`}>
          {fields.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Không tìm thấy thông số nào phù hợp với từ khóa &ldquo;{search}&rdquo;.
            </div>
          ) : viewMode === "matrix" && matrixTables.length > 0 && !search.trim() ? (
            /* ========================================================== */
            /* CHẾ ĐỘ 1: BẢNG MA TRẬN THEO NHÓM & MỐC GIỜ (SPREADSHEET)   */
            /* ========================================================== */
            <div className="grid gap-4">
              {matrixTables.map((table, tIdx) => (
                <div key={tIdx} className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-[#eef3f9] text-[#173b64]">
                        <th className="p-2 text-left font-bold">Chỉ tiêu / Thông số</th>
                        {table.columns.map(col => (
                          <th key={col} className="w-24 p-2 text-center font-bold tracking-wider">
                            {col}
                          </th>
                        ))}
                        <th className="w-20 p-2 text-center font-bold">Nguồn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {table.rows.map((row, rIdx) => {
                        const anyLinked = row.items.some(i => CTKTKT_BCSX_LINKED_CELLS.has(i.field.cell));
                        return (
                          <tr key={rIdx} className={`hover:bg-slate-50/70 ${anyLinked ? "bg-blue-50/20" : ""}`}>
                            <td className="p-2 font-semibold text-slate-800">
                              <span className="leading-snug">{row.base}</span>
                            </td>
                            {table.columns.map(col => {
                              const item = row.items.find(i => i.col === col);
                              if (!item) {
                                return (
                                  <td key={col} className="p-1.5 text-center text-slate-300">
                                    —
                                  </td>
                                );
                              }
                              const linked = CTKTKT_BCSX_LINKED_CELLS.has(item.field.cell);
                              return (
                                <td key={col} className="p-1 text-center">
                                  <div className="flex flex-col items-center gap-0.5">
                                    <code className={`text-[9px] font-bold font-mono ${
                                      linked ? "text-blue-700" : "text-amber-800"
                                    }`}>
                                      {item.field.cell}
                                    </code>
                                    <input
                                      disabled={linked || !canEdit || loading}
                                      inputMode={item.field.cell === "T181" ? "text" : "decimal"}
                                      value={current[item.field.cell] || ""}
                                      onChange={event => update(item.field.cell, event.target.value)}
                                      className={`h-7 w-20 rounded border px-1.5 text-right font-mono text-xs font-bold tabular-nums outline-none transition-colors focus:border-[#4057b5] focus:ring-1 focus:ring-[#4057b5] disabled:bg-slate-100/80 disabled:text-slate-500 ${
                                        linked ? "border-blue-200 bg-blue-50/60" : "border-slate-200 bg-white"
                                      }`}
                                      placeholder="—"
                                    />
                                  </div>
                                </td>
                              );
                            })}
                            <td className="p-1.5 text-center">
                              {anyLinked ? (
                                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-800">
                                  BCSX
                                </span>
                              ) : (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                                  Nhập
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}

              {/* Các ô đơn lẻ không có mốc giờ */}
              {matrixSingles.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-black text-slate-500 uppercase tracking-wider">
                    Các thông số đơn lẻ ({matrixSingles.length})
                  </h3>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                    {matrixSingles.map(field => {
                      const linked = CTKTKT_BCSX_LINKED_CELLS.has(field.cell);
                      const displayLabel = getFieldDisplayLabel(field);
                      return (
                        <label
                          key={field.cell}
                          className={`flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold transition-all ${
                            linked
                              ? "border-blue-200 bg-blue-50/40"
                              : "border-slate-200 bg-white hover:border-indigo-300"
                          }`}
                          title={`${field.cell}: ${displayLabel}`}
                        >
                          <div className="flex min-w-0 items-center gap-1 flex-1">
                            <code className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-bold font-mono ${
                              linked ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700"
                            }`}>
                              {field.cell}
                            </code>
                            <span className="truncate text-[11px] text-slate-700">{displayLabel}</span>
                          </div>
                          <input
                            disabled={linked || !canEdit || loading}
                            inputMode={field.cell === "T181" ? "text" : "decimal"}
                            value={current[field.cell] || ""}
                            onChange={event => update(field.cell, event.target.value)}
                            className="h-7 w-20 shrink-0 rounded border border-slate-200 bg-white px-1.5 text-right font-mono text-xs font-bold tabular-nums text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
                            placeholder="—"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : viewMode === "dense" || (viewMode === "matrix" && search.trim()) ? (
            /* ========================================================== */
            /* CHẾ ĐỘ 2: LƯỚI Ô SIÊU GỌN (DENSE INLINE GRID) — TỐI ƯU NHẤT */
            /* ========================================================== */
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {fields.map(field => {
                const linked = CTKTKT_BCSX_LINKED_CELLS.has(field.cell);
                const displayLabel = getFieldDisplayLabel(field);
                return (
                  <label
                    key={field.cell}
                    className={`group flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold transition-all ${
                      linked
                        ? "border-blue-200 bg-blue-50/40 hover:bg-blue-50/70"
                        : "border-slate-200 bg-white hover:border-indigo-300 hover:shadow-2xs"
                    }`}
                    title={`${field.cell}: ${displayLabel}${linked ? " (Liên kết từ BCSX)" : ""}`}
                  >
                    <div className="flex min-w-0 items-center gap-1.5 flex-1">
                      <code className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-bold font-mono ${
                        linked ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700 group-hover:bg-amber-100 group-hover:text-amber-900"
                      }`}>
                        {field.cell}
                      </code>
                      <span className="truncate text-[11px] text-slate-700">
                        {displayLabel}
                      </span>
                      {linked && (
                        <span className="shrink-0 rounded bg-blue-100 px-1 py-0.2 text-[9px] font-bold text-blue-700">
                          BCSX
                        </span>
                      )}
                    </div>
                    <input
                      disabled={linked || !canEdit || loading}
                      inputMode={field.cell === "T181" ? "text" : "decimal"}
                      value={current[field.cell] || ""}
                      onChange={event => update(field.cell, event.target.value)}
                      className={`h-7 w-20 shrink-0 rounded border bg-white px-1.5 text-right font-mono text-xs font-bold tabular-nums text-slate-900 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100/80 disabled:text-slate-500 ${
                        linked ? "border-blue-200" : "border-slate-200"
                      }`}
                      placeholder="—"
                    />
                  </label>
                );
              })}
            </div>
          ) : (
            /* ========================================================== */
            /* CHẾ ĐỘ 3: THẺ GỌN (COMPACT CARDS — 2 DÒNG TINH CHỈNH)     */
            /* ========================================================== */
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
              {fields.map(field => {
                const linked = CTKTKT_BCSX_LINKED_CELLS.has(field.cell);
                const displayLabel = getFieldDisplayLabel(field);
                return (
                  <div
                    key={field.cell}
                    className={`flex flex-col justify-between gap-1 rounded-lg border p-1.5 text-xs font-semibold ${
                      linked ? "border-blue-200 bg-blue-50/50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <code className={`rounded px-1 py-0.2 text-[10px] font-bold font-mono ${
                        linked ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700"
                      }`}>
                        {field.cell}
                      </code>
                      <span className="truncate text-[10px] text-slate-600" title={displayLabel}>
                        {displayLabel}
                      </span>
                      {linked && (
                        <span className="shrink-0 rounded bg-blue-100 px-1 text-[8px] font-bold text-blue-700">
                          BCSX
                        </span>
                      )}
                    </div>
                    <input
                      disabled={linked || !canEdit || loading}
                      inputMode={field.cell === "T181" ? "text" : "decimal"}
                      value={current[field.cell] || ""}
                      onChange={event => update(field.cell, event.target.value)}
                      className="h-7 w-full rounded border border-slate-200 bg-white px-1.5 text-right font-mono text-xs font-bold tabular-nums text-slate-900 outline-none focus:border-[#4057b5] focus:ring-1 focus:ring-[#4057b5] disabled:bg-slate-100 disabled:text-slate-500"
                      placeholder="—"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer ghi chú */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-[#fffbeb] px-3.5 py-1.5 text-[11px] text-amber-900">
          <span>
            {editableFields.length} ô nhập tay · 42 ô liên kết tự động từ BCSX mục 1. Ô công thức khóa trên web; file xuất yêu cầu Excel tính lại khi mở.
          </span>
          <span className="font-semibold text-amber-800">
            {viewMode === "dense" ? "Chế độ: Lưới siêu gọn" : viewMode === "matrix" ? "Chế độ: Bảng ma trận" : "Chế độ: Thẻ gọn"}
          </span>
        </div>
      </div>

      {/* 4. Cảnh báo kỹ thuật file nguồn */}
      <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-900">
        <p className="font-bold">Lưu ý tham chiếu file nguồn</p>
        <p className="mt-0.5 text-slate-600">
          File gốc có công thức <code>#REF!</code> và liên kết <code>[2]16</code>. Hệ thống không dùng các lỗi này để tính KPI trên web; chúng được giữ nguyên trong mẫu xuất để truy vết đối chiếu.
        </p>
      </div>
    </section>
  );
}
