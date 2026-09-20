"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DateField } from "@/components/ui/date-field";
import { GoogleSheetSyncButton } from "@/components/google-sheet-sync-button";
import { CAPACITY_KW, calculateActualHeatRate, calculatePpaHeatRateDetailed, compareHeatRate, ppaCurveForYear, type PpaSourceData, type UnitDetail } from "@/lib/ppa-heat-rate";
import { loadSheetJs, type SheetJsLib } from "@/lib/sheetjs-loader";
import { useSessionUser } from "@/components/session-context";
import { hasPermission } from "@/lib/auth/session";
import { PPA_AVAILABLE_CAPACITY_S1_CODE, PPA_AVAILABLE_CAPACITY_S2_CODE } from "@/lib/google-sheet-sync";
import { addDaysIso, defaultOperatingDate, vietnamDateIso } from "@/lib/operating-date";

type DailyInput = { operatingDate: string; fieldCode: string; value: string };
type StoredPpa = {
  operatingDate: string;
  ppaPlant: string | number;
  ppaS1: string | number;
  ppaS2: string | number;
  grossS1Kwh?: string | number;
  netS1Kwh?: string | number;
  grossS2Kwh?: string | number;
  netS2Kwh?: string | number;
  noteS1: string;
  noteS2: string;
};
// entries?includeSource=1 trả thêm "source" (4 dãy 48 chu kỳ gốc) đã lưu khi nhập ngày đó —
// dùng để tái tạo các sheet S1/S2/từng ngày giống file mẫu khi xuất Excel.
type StoredPpaWithSource = StoredPpa & { source?: PpaSourceData | null };

type UnitKey = "plant" | "s1" | "s2";

type Row = {
  date: string;
  ppaPlant: number | null; actualPlant: number | null;
  ppaS1: number | null; actualS1: number | null;
  ppaS2: number | null; actualS2: number | null;
  netS1Kwh: number | null; netS2Kwh: number | null;
  availableCapacityS1Mw: number | null; availableCapacityS2Mw: number | null;
  noteS1: string; noteS2: string;
};

// Màu đường "thực tế" đậm nhất (đường chính), đường "theo PPA" dùng màu accent của tổ máy — đậm hơn
// hẳn bản trước để 2 đường không bị nhạt nhòe trên nền biểu đồ. Cột chênh lệch không còn dùng 1 màu
// cố định theo tổ máy nữa mà tô theo dấu: barUnder (xanh) khi thực tế dưới/đúng PPA, barOver (đỏ
// nhạt) khi vượt PPA — xem renderBarColor bên dưới.
const UNIT_META: Record<UnitKey, { label: string; accent: string; border: string; bg: string; text: string; gradient: string; lineActual: string; linePpa: string }> = {
  s1: { label: "Tổ máy S1", accent: "#2f6fb0", border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-800", gradient: "from-[#2f6fb0] to-[#5fa3e0]", lineActual: "#0f2d52", linePpa: "#2f6fb0" },
  s2: { label: "Tổ máy S2", accent: "#b9860f", border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-800", gradient: "from-[#b9860f] to-[#e0ad3d]", lineActual: "#5c4106", linePpa: "#b9860f" },
  plant: { label: "Chung 2 tổ", accent: "#6b4fa0", border: "border-purple-200", bg: "bg-purple-50", text: "text-purple-800", gradient: "from-[#6b4fa0] to-[#9b7bc9]", lineActual: "#2e1f47", linePpa: "#6b4fa0" },
};

const BAR_UNDER_PPA = "#4caf7d"; // dưới/đúng PPA — xanh lá
const BAR_OVER_PPA = "#f2a29b"; // vượt PPA — đỏ nhạt

const numberFormat = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percentFormat = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const format = (value: number | null | undefined) => value === null || value === undefined || !Number.isFinite(value) ? "—" : numberFormat.format(value);
const formatPercent = (value: number | null | undefined) => value === null || value === undefined || !Number.isFinite(value) ? "—" : `${percentFormat.format(value)}%`;
const shortDate = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
const fullDate = (iso: string) => iso.split("-").reverse().join("/");
const monthLabel = (period: string) => `Tháng ${period.slice(5, 7)}/${period.slice(0, 4)}`;

function ExpandableNote({ note }: { note: string }) {
  if (!note.trim()) return <span className="text-slate-400">—</span>;

  return <details className="group min-w-0">
    <summary
      className="block min-w-0 cursor-pointer list-none rounded-md px-1 py-0.5 outline-none transition hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-[#4c78a8] [&::-webkit-details-marker]:hidden"
      title="Bấm để xem đầy đủ nội dung"
    >
      <span className="block truncate leading-4 group-open:hidden">{note}</span>
      <span className="hidden whitespace-pre-wrap break-words leading-4 [overflow-wrap:anywhere] group-open:block">{note}</span>
    </summary>
  </details>;
}

function periodsBetween(from: string, to: string) {
  const periods: string[] = [];
  let [year, month] = [Number(from.slice(0, 4)), Number(from.slice(5, 7))];
  const endYear = Number(to.slice(0, 4)), endMonth = Number(to.slice(5, 7));
  while (year < endYear || (year === endYear && month <= endMonth)) {
    periods.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1; if (month > 12) { month = 1; year += 1; }
    if (periods.length > 36) break;
  }
  return periods;
}

// ddMM (không có năm) — đúng cách đặt tên ngày trong file mẫu gốc (cột "Ngày" của sheet S1/S2
// và tên các sheet công tơ từng ngày, ví dụ "0108" = 01/08).
const ddMM = (iso: string) => `${iso.slice(8, 10)}${iso.slice(5, 7)}`;
const sumRange = (values: number[], from: number, to: number) => values.slice(from, to).reduce((sum, value) => sum + value, 0);

const S1S2_HEADER = ["NỘI DUNG", "Đơn vị", "Ngày", "Tổng", ...Array.from({ length: 48 }, (_, index) => `H${index + 1}`), "Sáng (0h-08h00)", "Chiều (08h00-16h00)", "Đêm (16h00-24h00)"];

// Hàng dữ liệu cho 3 khối "Sản lượng đầu cực" / "Sản lượng xuất tuyến" / "Nhiệt lượng theo PPA":
// Tổng/Sáng/Chiều/Đêm là tổng cộng dồn các chu kỳ trong khoảng đó (đã đối chiếu đúng với file mẫu gốc).
function metricBlockRow(iso: string, values: number[], label: string | null, unit: string | null) {
  return [label, unit, ddMM(iso), values.reduce((sum, value) => sum + value, 0), ...values, sumRange(values, 0, 16), sumRange(values, 16, 32), sumRange(values, 32, 48)];
}

// Hàng dữ liệu cho khối "SHN tổ máy theo PPA" (đơn vị kJ/kWh — là 1 suất hao nhiệt, không phải
// đại lượng cộng dồn được): Tổng/Sáng/Chiều/Đêm = (tổng nhiệt lượng)/(tổng sản lượng xuất tuyến)
// của đúng khoảng chu kỳ đó — đã đối chiếu khớp chính xác với file mẫu gốc (không phải trung bình
// cộng hay tổng cộng dồn giá trị suất hao nhiệt từng chu kỳ).
function rateBlockRow(iso: string, intervals: UnitDetail["intervals"], label: string | null, unit: string | null) {
  const rates = intervals.map(item => item.rate);
  const heat = intervals.map(item => item.heatKj), net = intervals.map(item => item.netKwh);
  const weighted = (from: number, to: number) => {
    const netSum = sumRange(net, from, to);
    return netSum > 0 ? sumRange(heat, from, to) / netSum : 0;
  };
  return [label, unit, ddMM(iso), weighted(0, 48), ...rates, weighted(0, 16), weighted(16, 32), weighted(32, 48)];
}

function buildUnitSheet(XLSX: SheetJsLib, days: { iso: string; detail: UnitDetail }[], year: number) {
  const curve = ppaCurveForYear(year);
  const rows: (string | number | null)[][] = [
    ["Công suất", "kJ/kWh", CAPACITY_KW.full, CAPACITY_KW.seventyFive, CAPACITY_KW.half],
    ["SHN", "kJ/kWh", curve.full, curve.seventyFive, curve.half],
    S1S2_HEADER,
  ];
  const blocks: { label: string; unit: string; pick?: (detail: UnitDetail) => number[]; rate?: boolean }[] = [
    { label: "Sản lượng đầu cực", unit: "kWh", pick: detail => detail.intervals.map(item => item.grossKwh) },
    { label: "Sản lượng xuất tuyến", unit: "kWh", pick: detail => detail.intervals.map(item => item.netKwh) },
    { label: "Nhiệt lượng theo PPA", unit: "kJ", pick: detail => detail.intervals.map(item => item.heatKj) },
    { label: "SHN tổ máy theo PPA", unit: "kJ/kWh", rate: true },
  ];
  for (const block of blocks) {
    days.forEach((day, index) => {
      const label = index === 0 ? block.label : null, unit = index === 0 ? block.unit : null;
      rows.push(block.rate ? rateBlockRow(day.iso, day.detail.intervals, label, unit) : metricBlockRow(day.iso, block.pick!(day.detail), label, unit));
    });
  }
  return XLSX.utils.aoa_to_sheet(rows);
}

// 1 sheet/ngày mô phỏng bảng số liệu công tơ gốc — chỉ gồm đúng 4 điểm đo (kênh kWhGiao) mà ứng
// dụng thực sự dùng để tính SHN theo PPA (DHA_S1/DH1_285M/DHA_S2/DH1_283M), vì đây là toàn bộ dữ
// liệu công tơ được lưu lại khi nhập ngày đó — file mẫu gốc có thêm nhiều điểm đo/kênh khác không
// dùng cho phép tính nên không có trong dữ liệu đã lưu.
const METER_ROWS: { key: keyof PpaSourceData; meter: string }[] = [
  { key: "grossS1", meter: "DHA_S1" },
  { key: "netS1", meter: "DH1_285M" },
  { key: "grossS2", meter: "DHA_S2" },
  { key: "netS2", meter: "DH1_283M" },
];

function buildMeterSheet(XLSX: SheetJsLib, iso: string, source: PpaSourceData) {
  const full = fullDate(iso);
  const rows: (string | number | null)[][] = [
    ["Công ty Nhiệt điện Duyên Hải"],
    ["Nhà máy: Duyên Hải 1"],
    [`Số liệu đo đếm công tơ ngày: ${full}`],
    ["Tên điểm đo", "Kênh", "Ngày", "Tổng", ...Array.from({ length: 48 }, (_, index) => `H${index + 1}`)],
    ["Điểm đo giao nhận"],
  ];
  for (const { key, meter } of METER_ROWS) {
    const values = source[key];
    rows.push([meter, "kWhGiao", full, values.reduce((sum, value) => sum + value, 0), ...values]);
  }
  return XLSX.utils.aoa_to_sheet(rows);
}

const PLANT_SHEET_HEADER = [
  "Ngày", "PPA chung", "PPA S1", "PPA S2", "Thực tế chung", "Thực tế S1", "Thực tế S2",
  "CL chung (kJ/kWh)", "CL chung (%)", "Đánh giá chung",
  "CL S1 (kJ/kWh)", "CL S1 (%)", "Đánh giá S1",
  "CL S2 (kJ/kWh)", "CL S2 (%)", "Đánh giá S2",
  "Nguyên nhân S1", "Nguyên nhân S2",
];

// Bình quân gia quyền theo sản lượng điểm bán (netKwh) trong tháng — đúng bản chất suất hao nhiệt
// (= tổng nhiệt lượng / tổng sản lượng), không phải trung bình cộng đơn giản theo số ngày.
function weightedAverage(values: (number | null)[], weights: (number | null)[]) {
  let sumValue = 0, sumWeight = 0;
  values.forEach((value, index) => {
    const weight = weights[index];
    if (value === null || weight === null || !Number.isFinite(value) || !Number.isFinite(weight)) return;
    sumValue += value * weight; sumWeight += weight;
  });
  return sumWeight > 0 ? sumValue / sumWeight : null;
}

function buildPlantSheet(XLSX: SheetJsLib, rowsByMonthLocal: [string, Row[]][]) {
  const rowsOut: (string | number | null)[][] = [PLANT_SHEET_HEADER];
  for (const [, monthRows] of rowsByMonthLocal) {
    for (const row of monthRows) {
      const plant = compareHeatRate(row.actualPlant, row.ppaPlant), s1 = compareHeatRate(row.actualS1, row.ppaS1), s2 = compareHeatRate(row.actualS2, row.ppaS2);
      rowsOut.push([
        fullDate(row.date), row.ppaPlant, row.ppaS1, row.ppaS2, row.actualPlant, row.actualS1, row.actualS2,
        plant.difference, plant.percent, plant.status,
        s1.difference, s1.percent, s1.status,
        s2.difference, s2.percent, s2.status,
        row.noteS1 || "", row.noteS2 || "",
      ]);
    }
    const netS1 = monthRows.map(row => row.netS1Kwh), netS2 = monthRows.map(row => row.netS2Kwh);
    const netPlant = monthRows.map(row => row.netS1Kwh === null && row.netS2Kwh === null ? null : (row.netS1Kwh ?? 0) + (row.netS2Kwh ?? 0));
    const ppaPlantAvg = weightedAverage(monthRows.map(row => row.ppaPlant), netPlant);
    const actualPlantAvg = weightedAverage(monthRows.map(row => row.actualPlant), netPlant);
    const ppaS1Avg = weightedAverage(monthRows.map(row => row.ppaS1), netS1);
    const actualS1Avg = weightedAverage(monthRows.map(row => row.actualS1), netS1);
    const ppaS2Avg = weightedAverage(monthRows.map(row => row.ppaS2), netS2);
    const actualS2Avg = weightedAverage(monthRows.map(row => row.actualS2), netS2);
    const plantCmp = compareHeatRate(actualPlantAvg, ppaPlantAvg), s1Cmp = compareHeatRate(actualS1Avg, ppaS1Avg), s2Cmp = compareHeatRate(actualS2Avg, ppaS2Avg);
    rowsOut.push([
      "Cả tháng", ppaPlantAvg, ppaS1Avg, ppaS2Avg, actualPlantAvg, actualS1Avg, actualS2Avg,
      plantCmp.difference, plantCmp.percent, plantCmp.status,
      s1Cmp.difference, s1Cmp.percent, s1Cmp.status,
      s2Cmp.difference, s2Cmp.percent, s2Cmp.status,
      "", "",
    ]);
  }
  return XLSX.utils.aoa_to_sheet(rowsOut);
}

export function PpaHeatRateDashboard() {
  const user = useSessionUser();
  const canEdit = hasPermission(user, "edit_ppa");
  const today = useMemo(() => vietnamDateIso(), []);
  const defaultDate = useMemo(() => defaultOperatingDate(), []);
  const [fromDate, setFromDate] = useState(() => addDaysIso(defaultOperatingDate(), -14));
  const [toDate, setToDate] = useState(defaultDate);
  const [rangeLabel, setRangeLabel] = useState("15 ngày gần nhất");
  const [entries, setEntries] = useState<StoredPpa[]>([]);
  const [dailyInputs, setDailyInputs] = useState<DailyInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [restoredCount, setRestoredCount] = useState<number | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sheetDate, setSheetDate] = useState(defaultDate);
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    date: string;
    noteS1: string;
    noteS2: string;
    availableCapacityS1Mw: string;
    availableCapacityS2Mw: string;
    saving: boolean;
    error: string;
  }>({
    isOpen: false,
    date: "",
    noteS1: "",
    noteS2: "",
    availableCapacityS1Mw: "",
    availableCapacityS2Mw: "",
    saving: false,
    error: "",
  });

  function openEditNote(row: Row) {
    setEditModal({
      isOpen: true,
      date: row.date,
      noteS1: row.noteS1 || "",
      noteS2: row.noteS2 || "",
      availableCapacityS1Mw: row.availableCapacityS1Mw === null ? "" : String(row.availableCapacityS1Mw),
      availableCapacityS2Mw: row.availableCapacityS2Mw === null ? "" : String(row.availableCapacityS2Mw),
      saving: false,
      error: "",
    });
  }

  async function handleSaveNote() {
    if (!editModal.date) return;
    setEditModal(prev => ({ ...prev, saving: true, error: "" }));
    try {
      const response = await fetch("/api/ppa-heat-rate/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: [{
            operatingDate: editModal.date,
            noteS1: editModal.noteS1.trim(),
            noteS2: editModal.noteS2.trim(),
            availableCapacityS1Mw: editModal.availableCapacityS1Mw.trim(),
            availableCapacityS2Mw: editModal.availableCapacityS2Mw.trim(),
          }]
        })
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Chưa lưu được nhận xét.");

      setEntries(prev => prev.map(entry => {
        if (entry.operatingDate === editModal.date) {
          return {
            ...entry,
            noteS1: editModal.noteS1.trim(),
            noteS2: editModal.noteS2.trim(),
          };
        }
        return entry;
      }));
      setDailyInputs(prev => {
        const next = prev.filter(entry => !(entry.operatingDate === editModal.date && (entry.fieldCode === PPA_AVAILABLE_CAPACITY_S1_CODE || entry.fieldCode === PPA_AVAILABLE_CAPACITY_S2_CODE)));
        if (editModal.availableCapacityS1Mw.trim()) next.push({ operatingDate: editModal.date, fieldCode: PPA_AVAILABLE_CAPACITY_S1_CODE, value: editModal.availableCapacityS1Mw.trim().replace(",", ".") });
        if (editModal.availableCapacityS2Mw.trim()) next.push({ operatingDate: editModal.date, fieldCode: PPA_AVAILABLE_CAPACITY_S2_CODE, value: editModal.availableCapacityS2Mw.trim().replace(",", ".") });
        return next;
      });

      setEditModal(prev => ({ ...prev, isOpen: false, saving: false }));
    } catch (caught) {
      setEditModal(prev => ({
        ...prev,
        saving: false,
        error: caught instanceof Error ? caught.message : "Chưa lưu được nhận xét."
      }));
    }
  }

  async function loadRange(from: string, to: string, clampToData: boolean) {
    setLoading(true); setError("");
    try {
      const periods = periodsBetween(from, to);
      const responses = await Promise.all(periods.map(period => Promise.all([
        fetch(`/api/ppa-heat-rate?period=${period}`, { cache: "no-store" }).then(response => response.json() as Promise<{ entries?: StoredPpa[]; error?: string }>),
        fetch(`/api/daily-inputs?period=${period}`, { cache: "no-store" }).then(response => response.json() as Promise<{ entries?: DailyInput[]; error?: string }>),
      ])));
      const allPpa = responses.flatMap(([ppaBody]) => ppaBody.entries || []);
      const allDaily = responses.flatMap(([, dailyBody]) => dailyBody.entries || []);
      if (clampToData && allPpa.length) {
        const dates = allPpa.map(entry => entry.operatingDate).sort();
        from = dates[0]; to = dates[dates.length - 1];
        setFromDate(from); setToDate(to);
      }
      const filteredPpa = allPpa.filter(entry => entry.operatingDate >= from && entry.operatingDate <= to);
      setEntries(filteredPpa);
      if (filteredPpa.length) {
        const latestSavedDate = [...filteredPpa].sort((a, b) => b.operatingDate.localeCompare(a.operatingDate))[0].operatingDate;
        setSheetDate(current => filteredPpa.some(entry => entry.operatingDate === current) ? current : latestSavedDate);
      }
      setDailyInputs(allDaily.filter(entry => entry.operatingDate >= from && entry.operatingDate <= to));
      setRestoredCount(filteredPpa.length);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tải được dữ liệu so sánh.");
    } finally { setLoading(false); }
  }

  // Chỉ tải một lần khi mở trang; các thao tác đổi khoảng ngày sau đó tự gọi loadRange qua sự kiện người dùng.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void loadRange(fromDate, toDate, false); }, []);

  function applyQuick(kind: "last15" | "all") {
    if (kind === "last15") {
      const from = addDaysIso(defaultDate, -14);
      setFromDate(from); setToDate(defaultDate); setRangeLabel("15 ngày gần nhất");
      void loadRange(from, defaultDate, false);
    } else {
      setRangeLabel("Xem tất cả");
      void loadRange("2026-01", defaultDate, true);
    }
  }

  function applyManualRange() {
    setRangeLabel("Tuỳ chọn");
    void loadRange(fromDate, toDate, false);
  }

  const dailyValuesByDate = useMemo(() => {
    const grouped = new Map<string, Record<string, string>>();
    for (const entry of dailyInputs) grouped.set(entry.operatingDate, { ...(grouped.get(entry.operatingDate) || {}), [entry.fieldCode]: entry.value });
    return grouped;
  }, [dailyInputs]);

  const actualByDate = useMemo(() => new Map([...dailyValuesByDate].map(([date, values]) => [date, calculateActualHeatRate(values)])), [dailyValuesByDate]);

  const rows: Row[] = useMemo(() => {
    return [...entries]
      .sort((a, b) => a.operatingDate.localeCompare(b.operatingDate))
      .map(entry => {
        const actual = actualByDate.get(entry.operatingDate) || null;
        const daily = dailyValuesByDate.get(entry.operatingDate) || {};
        const capacityS1 = Number(daily[PPA_AVAILABLE_CAPACITY_S1_CODE]);
        const capacityS2 = Number(daily[PPA_AVAILABLE_CAPACITY_S2_CODE]);
        return {
          date: entry.operatingDate,
          ppaPlant: Number(entry.ppaPlant), actualPlant: actual?.actualPlant ?? null,
          ppaS1: Number(entry.ppaS1), actualS1: actual?.actualS1 ?? null,
          ppaS2: Number(entry.ppaS2), actualS2: actual?.actualS2 ?? null,
          netS1Kwh: entry.netS1Kwh !== undefined && entry.netS1Kwh !== null ? Number(entry.netS1Kwh) : null,
          netS2Kwh: entry.netS2Kwh !== undefined && entry.netS2Kwh !== null ? Number(entry.netS2Kwh) : null,
          availableCapacityS1Mw: daily[PPA_AVAILABLE_CAPACITY_S1_CODE]?.trim() !== "" && Number.isFinite(capacityS1) ? capacityS1 : null,
          availableCapacityS2Mw: daily[PPA_AVAILABLE_CAPACITY_S2_CODE]?.trim() !== "" && Number.isFinite(capacityS2) ? capacityS2 : null,
          noteS1: entry.noteS1 || "", noteS2: entry.noteS2 || "",
        };
      });
  }, [entries, actualByDate, dailyValuesByDate]);

  const rowsByMonth = useMemo(() => {
    const groups = new Map<string, Row[]>();
    for (const row of rows) {
      const period = row.date.slice(0, 7);
      groups.set(period, [...(groups.get(period) || []), row]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  function summaryFor(unit: UnitKey) {
    const pairs = rows.map(row => {
      const actual = unit === "plant" ? row.actualPlant : unit === "s1" ? row.actualS1 : row.actualS2;
      const ppa = unit === "plant" ? row.ppaPlant : unit === "s1" ? row.ppaS1 : row.ppaS2;
      return { date: row.date, actual, ppa, comparison: compareHeatRate(actual, ppa) };
    }).filter(item => item.actual !== null && item.ppa !== null);
    const avg = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    const exceeded = pairs.filter(item => item.comparison.status === "Vượt PPA").length;
    const met = pairs.filter(item => item.comparison.status === "Đạt").length;
    return {
      avgActual: avg(pairs.map(item => item.actual as number)),
      avgPpa: avg(pairs.map(item => item.ppa as number)),
      avgDiff: avg(pairs.map(item => item.comparison.difference as number)),
      exceeded, met, total: pairs.length,
    };
  }

  const chartData = (unit: UnitKey) => rows.map(row => {
    const actual = unit === "plant" ? row.actualPlant : unit === "s1" ? row.actualS1 : row.actualS2;
    const ppa = unit === "plant" ? row.ppaPlant : unit === "s1" ? row.ppaS1 : row.ppaS2;
    const comparison = compareHeatRate(actual, ppa);
    return { date: shortDate(row.date), thucTe: actual, ppa, chenhLech: comparison.difference };
  });

  const noteworthy = useMemo(() => rows.filter(row => compareHeatRate(row.actualPlant, row.ppaPlant).status === "Vượt PPA"), [rows]);
  const hasSavedPpaForSheet = entries.some(entry => entry.operatingDate === sheetDate);
  const sheetRow = rows.find(row => row.date === sheetDate);
  const hasAvailableCapacityForSheet = Boolean(sheetRow && sheetRow.availableCapacityS1Mw !== null && sheetRow.availableCapacityS2Mw !== null);
  const sheetDisabledReason = !hasSavedPpaForSheet
    ? "Ngày này chưa có kết quả PPA đã lưu."
    : !hasAvailableCapacityForSheet
      ? "Ngày này chưa nhập đủ Công suất khả dụng S1 và S2. Bấm vào ngày trong bảng chi tiết để bổ sung."
      : "";

  async function exportXlsx() {
    setExporting(true); setError("");
    try {
      const XLSX = await loadSheetJs();
      const workbook = XLSX.utils.book_new();
      const usedSheetNames = new Set<string>();
      const addSheet = (wantedName: string, sheet: unknown) => {
        let name = wantedName.slice(0, 31), suffix = 2;
        while (usedSheetNames.has(name)) { name = `${wantedName.slice(0, 28)}_${suffix}`.slice(0, 31); suffix += 1; }
        usedSheetNames.add(name);
        XLSX.utils.book_append_sheet(workbook, sheet, name);
      };

      addSheet("Cả nhà máy DH1", buildPlantSheet(XLSX, rowsByMonth));

      // Sheet "S1"/"S2" (chi tiết 48 chu kỳ/ngày) và 1 sheet/ngày (số liệu công tơ) chỉ dựng
      // được từ dữ liệu gốc đã lưu (source_data) — gọi riêng với includeSource=1 vì API tải
      // trang không kèm phần này (nặng, chỉ cần khi xuất file).
      const periods = periodsBetween(fromDate, toDate);
      for (const period of periods) {
        const response = await fetch(`/api/ppa-heat-rate?period=${period}&includeSource=1`, { cache: "no-store" });
        const body = await response.json() as { entries?: StoredPpaWithSource[]; error?: string };
        const entries = (body.entries || [])
          .filter(entry => entry.operatingDate >= fromDate && entry.operatingDate <= toDate && entry.source)
          .sort((a, b) => a.operatingDate.localeCompare(b.operatingDate));
        if (!entries.length) continue;
        const year = Number(period.slice(0, 4));
        const s1Days: { iso: string; detail: UnitDetail }[] = [];
        const s2Days: { iso: string; detail: UnitDetail }[] = [];
        for (const entry of entries) {
          if (!entry.source) continue;
          try {
            const detailed = calculatePpaHeatRateDetailed(entry.source, year);
            s1Days.push({ iso: entry.operatingDate, detail: detailed.s1 });
            s2Days.push({ iso: entry.operatingDate, detail: detailed.s2 });
            addSheet(ddMM(entry.operatingDate), buildMeterSheet(XLSX, entry.operatingDate, entry.source));
          } catch {
            // Bỏ qua ngày có dữ liệu công tơ gốc không còn hợp lệ (ví dụ thiếu đủ 48 chu kỳ) —
            // các sheet khác vẫn xuất bình thường.
          }
        }
        const monthSuffix = periods.length > 1 ? `_${period.replace("-", "")}` : "";
        if (s1Days.length) addSheet(`S1${monthSuffix}`, buildUnitSheet(XLSX, s1Days, year));
        if (s2Days.length) addSheet(`S2${monthSuffix}`, buildUnitSheet(XLSX, s2Days, year));
      }

      XLSX.writeFile(workbook, `so-sanh-ppa-${fromDate}_${toDate}.xlsx`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Chưa xuất được file Excel.");
    } finally { setExporting(false); }
  }

  return <section className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#557187]">Theo dõi hiệu suất vận hành</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#18233d]">So sánh trực quan SHN Thực tế và PPA</h1>
        <p className="mt-1 text-sm text-slate-500">Tổng hợp từ kết quả đã lưu theo ngày. Chọn khoảng thời gian để xem biểu đồ và bảng chi tiết.</p>
      </div>
      <div className="flex flex-wrap items-end justify-end gap-2">
        <label className="grid gap-1 text-xs font-bold text-slate-600">NGÀY ĐẨY GOOGLE SHEET<DateField value={sheetDate} onChange={setSheetDate} className="w-[180px]"/></label>
        <GoogleSheetSyncButton operatingDate={sheetDate} disabled={!hasSavedPpaForSheet || !hasAvailableCapacityForSheet} disabledReason={sheetDisabledReason} onImported={() => loadRange(fromDate, toDate, false)}/>
        <button type="button" disabled={exporting || !rows.length} onClick={() => void exportXlsx()} className="h-10 rounded-xl bg-gradient-to-r from-[#4057b5] to-[#438ec1] px-4 text-sm font-bold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-50">{exporting ? "Đang xuất…" : "Xuất kết quả (.xlsx)"}</button>
      </div>
    </div>

    <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <label className="grid gap-1 text-xs font-bold text-slate-600">TỪ NGÀY<DateField value={fromDate} max={toDate} onChange={setFromDate} className="w-[150px]"/></label>
      <label className="grid gap-1 text-xs font-bold text-slate-600">ĐẾN NGÀY<DateField value={toDate} min={fromDate} max={today} onChange={setToDate} className="w-[150px]"/></label>
      <button type="button" onClick={applyManualRange} className="h-10 rounded-xl border border-[#aebfe1] bg-[#eef3ff] px-4 text-sm font-bold text-[#354a9f]">Áp dụng</button>
      <div className="mx-1 h-8 w-px bg-slate-200"/>
      <button type="button" onClick={() => applyQuick("last15")} className={`h-10 rounded-xl px-4 text-sm font-bold ${rangeLabel === "15 ngày gần nhất" ? "bg-[#4057b5] text-white" : "border border-slate-300 bg-white text-slate-600"}`}>15 ngày gần nhất</button>
      <button type="button" onClick={() => applyQuick("all")} className={`h-10 rounded-xl px-4 text-sm font-bold ${rangeLabel === "Xem tất cả" ? "bg-[#4057b5] text-white" : "border border-slate-300 bg-white text-slate-600"}`}>Xem tất cả</button>
      <p className="ml-auto text-xs font-semibold text-slate-500">{loading ? "Đang tải…" : `${rows.length} ngày có kết quả đã lưu`}</p>
    </div>

    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800">{error}</p>}
    {!loading && restoredCount !== null && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900">Đã khôi phục {restoredCount} ngày kết quả đã lưu trên website.</p>}

    {noteworthy.length > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
      <button type="button" onClick={() => setNotesOpen(open => !open)} className="flex w-full items-center justify-between gap-2 text-left text-sm font-bold text-amber-900">
        <span>{noteworthy.length} lưu ý trong kết quả đã lưu — bấm mở bên dưới bảng để xem chi tiết</span>
        <span className="text-xs">{notesOpen ? "Thu gọn ▲" : "Mở rộng ▼"}</span>
      </button>
      {notesOpen && <ul className="mt-3 space-y-1.5 border-t border-amber-200 pt-3">
        {noteworthy.map(row => <li key={row.date} className="text-xs text-amber-900"><span className="font-bold">{fullDate(row.date)}</span> — vượt PPA chung. {row.noteS1 || row.noteS2 ? <>S1: {row.noteS1 || "—"}; S2: {row.noteS2 || "—"}</> : <span className="italic">Chưa ghi nguyên nhân.</span>}</li>)}
      </ul>}
    </div>}

    <div className="grid gap-4 lg:grid-cols-3">
      {(["s1", "s2", "plant"] as UnitKey[]).map(unit => {
        const meta = UNIT_META[unit], summary = summaryFor(unit);
        const unitChartData = chartData(unit);
        // Trục phải (chênh lệch) tự co theo đúng biên độ dữ liệu của nó (luôn bao gồm 0) thay vì
        // dùng domain mặc định — nếu không, vài ngày chênh lệch lớn bất thường sẽ kéo domain giãn ra
        // làm cột/đường chênh lệch các ngày còn lại bị dẹt, khó nhìn.
        const diffValues = unitChartData.map(point => point.chenhLech).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
        const diffMin = Math.min(0, ...diffValues), diffMax = Math.max(0, ...diffValues);
        const diffPad = Math.max(2, (diffMax - diffMin) * 0.25);
        const diffDomain: [number, number] = [Math.floor(diffMin - diffPad), Math.ceil(diffMax + diffPad)];
        // Trục trái (2 đường SHN thực tế / PPA) cũng co sát theo đúng khoảng giá trị thật của chúng
        // (không ép về 0 như trục phải, vì SHN luôn ở mức hàng nghìn) — nếu không, khoảng cách nhỏ
        // giữa 2 đường (vài chục kJ/kWh trên nền vài nghìn) sẽ bị domain mặc định nuốt mất, nhìn như
        // 1 đường phẳng.
        const leftValues = unitChartData.flatMap(point => [point.thucTe, point.ppa]).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
        const leftMin = leftValues.length ? Math.min(...leftValues) : 0, leftMax = leftValues.length ? Math.max(...leftValues) : 0;
        const leftPad = Math.max(5, (leftMax - leftMin) * 0.2);
        const leftDomain: [number, number] = [Math.floor(leftMin - leftPad), Math.ceil(leftMax + leftPad)];
        return <div key={unit} className={`overflow-hidden rounded-2xl border ${meta.border} bg-white shadow-sm`}>
          <div className={`bg-gradient-to-r ${meta.gradient} px-4 py-3 text-white`}><p className="text-xs font-bold uppercase tracking-wide opacity-90">{meta.label}</p></div>
          <div className={`grid grid-cols-2 gap-2 p-3 text-xs ${meta.bg}`}>
            <div className="rounded-lg bg-white/70 p-2"><p className="text-slate-500">SHN Thực tế TB</p><p className={`text-base font-extrabold ${meta.text}`}>{format(summary.avgActual)}</p></div>
            <div className="rounded-lg bg-white/70 p-2"><p className="text-slate-500">SHN theo PPA TB</p><p className={`text-base font-extrabold ${meta.text}`}>{format(summary.avgPpa)}</p></div>
            <div className="rounded-lg bg-white/70 p-2"><p className="text-slate-500">Chênh lệch TB</p><p className={`text-base font-extrabold ${(summary.avgDiff ?? 0) > 0 ? "text-red-700" : "text-emerald-700"}`}>{format(summary.avgDiff)}</p></div>
            <div className="rounded-lg bg-white/70 p-2"><p className="text-slate-500">Số ngày vượt/đạt</p><p className="text-base font-extrabold text-slate-800">{summary.exceeded} / {summary.met}</p></div>
          </div>
          <div className="h-56 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={unitChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e9f2"/>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd"/>
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} width={44} domain={leftDomain} allowDataOverflow/>
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} width={40} domain={diffDomain} allowDataOverflow/>
                <Tooltip formatter={(value: unknown) => format(typeof value === "number" ? value : Number(value))} labelFormatter={label => `Ngày ${label}`}/>
                <Legend wrapperStyle={{ fontSize: 11 }}/>
                <Bar yAxisId="right" dataKey="chenhLech" name="Chênh lệch" radius={[3, 3, 0, 0]}>
                  {unitChartData.map((point, index) => <Cell key={index} fill={(point.chenhLech ?? 0) > 0 ? BAR_OVER_PPA : BAR_UNDER_PPA}/>)}
                </Bar>
                <Line yAxisId="left" type="monotone" dataKey="thucTe" name="SHN thực tế" stroke={meta.lineActual} strokeWidth={2} dot={false}/>
                <Line yAxisId="left" type="monotone" dataKey="ppa" name="SHN theo PPA" stroke={meta.linePpa} strokeWidth={2} strokeDasharray="4 3" dot={false}/>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>;
      })}
    </div>

    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b bg-[#f8fafc] px-4 py-3"><h2 className="font-extrabold text-[#20345f]">Bảng chi tiết theo ngày</h2></div>
      {!rows.length ? <div className="grid min-h-40 place-items-center p-6 text-sm text-slate-500">{loading ? "Đang tải dữ liệu…" : "Chưa có kết quả đã lưu trong khoảng thời gian này."}</div> : <div className="w-full overflow-hidden">
        <table className="w-full table-fixed border-collapse text-[10px] [&_td]:border-r [&_td]:border-slate-200 [&_th]:border-r [&_th]:border-slate-200 xl:text-[11px]">
          <colgroup>
            <col style={{ width: "5%" }}/>
            {Array.from({ length: 17 }, (_, index) => <col key={index} style={{ width: "3.94%" }}/>) }
            <col style={{ width: "14%" }}/>
            <col style={{ width: "14%" }}/>
          </colgroup>
          <thead>
            <tr className="bg-[#dcebf5] text-[#173b64]">
              <th rowSpan={2} className="px-1 py-2 text-center align-bottom">Ngày</th>
              <th colSpan={5} className="border-l border-white/60 p-2 text-center text-purple-900">Chung 2 tổ</th>
              <th colSpan={6} className="border-l border-white/60 p-2 text-center text-blue-900">Tổ máy S1</th>
              <th colSpan={6} className="border-l border-white/60 p-2 text-center text-amber-900">Tổ máy S2</th>
              <th rowSpan={2} className="border-l border-white/60 bg-blue-100 px-1 py-2 text-left align-bottom text-blue-950">Nhận xét S1</th>
              <th rowSpan={2} className="border-l border-white/60 bg-amber-100 px-1 py-2 text-left align-bottom text-amber-950">Nhận xét S2</th>
            </tr>
            <tr className="bg-[#eaf3fa] text-[#173b64]">
              {["Thực tế", "PPA", "CL kJ/kWh", "CL %", "TT", "Thực tế", "PPA", "CS khả dụng", "CL kJ/kWh", "CL %", "TT", "Thực tế", "PPA", "CS khả dụng", "CL kJ/kWh", "CL %", "TT"].map((label, index) => <th key={index} className="border-l border-white/60 px-0.5 py-1.5 text-center font-semibold leading-tight">{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rowsByMonth.map(([period, monthRows]) => <Fragment key={period}>
              <tr className="bg-slate-100"><td colSpan={20} className="px-2 py-1.5 text-left text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{monthLabel(period)}</td></tr>
              {monthRows.map(row => {
                const plant = compareHeatRate(row.actualPlant, row.ppaPlant), s1 = compareHeatRate(row.actualS1, row.ppaS1), s2 = compareHeatRate(row.actualS2, row.ppaS2);
                const statusBadge = (status: string) => <span className={`rounded-full px-1 py-0.5 text-[9px] font-extrabold ${status === "Đạt" ? "bg-emerald-100 text-emerald-800" : status === "Vượt PPA" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-500"}`}>{status === "Chưa đủ dữ liệu" ? "—" : status === "Vượt PPA" ? "Vượt" : "Đạt"}</span>;
                return <tr key={row.date} className="border-t border-slate-200 hover:bg-slate-50/60">
                  <td className="whitespace-nowrap px-0.5 py-1 text-center font-bold text-black">
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => openEditNote(row)}
                        className="text-center font-bold text-[#18233d] hover:text-[#4057b5] hover:underline"
                        title={`Bấm để xem hoặc chỉnh sửa nhận xét ngày ${fullDate(row.date)}`}
                      >
                        <span className="hidden xl:inline">{fullDate(row.date)}</span>
                        <span className="xl:hidden">{shortDate(row.date)}</span>
                      </button>
                    ) : (
                      <>
                        <span className="hidden xl:inline">{fullDate(row.date)}</span>
                        <span className="xl:hidden">{shortDate(row.date)}</span>
                      </>
                    )}
                  </td>
                  <td className="border-l px-0.5 py-1 text-center text-black">{format(row.actualPlant)}</td><td className="px-0.5 py-1 text-center text-black">{format(row.ppaPlant)}</td><td className="px-0.5 py-1 text-center text-black">{format(plant.difference)}</td><td className="px-0.5 py-1 text-center text-black">{formatPercent(plant.percent)}</td><td className="px-0.5 py-1 text-center">{statusBadge(plant.status)}</td>
                  <td className="border-l px-0.5 py-1 text-center text-black">{format(row.actualS1)}</td><td className="px-0.5 py-1 text-center text-black">{format(row.ppaS1)}</td><td className="bg-blue-50/50 px-0.5 py-1 text-center font-semibold text-blue-900">{format(row.availableCapacityS1Mw)}</td><td className="px-0.5 py-1 text-center text-black">{format(s1.difference)}</td><td className="px-0.5 py-1 text-center text-black">{formatPercent(s1.percent)}</td><td className="px-0.5 py-1 text-center">{statusBadge(s1.status)}</td>
                  <td className="border-l px-0.5 py-1 text-center text-black">{format(row.actualS2)}</td><td className="px-0.5 py-1 text-center text-black">{format(row.ppaS2)}</td><td className="bg-amber-50/50 px-0.5 py-1 text-center font-semibold text-amber-900">{format(row.availableCapacityS2Mw)}</td><td className="px-0.5 py-1 text-center text-black">{format(s2.difference)}</td><td className="px-0.5 py-1 text-center text-black">{formatPercent(s2.percent)}</td><td className="px-0.5 py-1 text-center">{statusBadge(s2.status)}</td>
                  <td className="border-l bg-blue-50/40 p-1 align-middle text-slate-700">
                    <div className="flex items-center justify-between gap-1">
                      <div className="min-w-0 flex-1">
                        {row.noteS1 ? (
                          <ExpandableNote note={row.noteS1} />
                        ) : canEdit ? (
                          <button
                            type="button"
                            onClick={() => openEditNote(row)}
                            className="text-[10px] italic text-blue-600/70 hover:text-blue-900 hover:underline"
                            title="Bổ sung nhận xét S1"
                          >
                            + Nhận xét
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                      {canEdit && row.noteS1 && (
                        <button
                          type="button"
                          onClick={() => openEditNote(row)}
                          className="shrink-0 rounded p-0.5 text-[10px] text-blue-600 opacity-40 transition hover:bg-blue-200 hover:opacity-100"
                          title={`Chỉnh sửa nhận xét ngày ${fullDate(row.date)}`}
                        >
                          ✏️
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="border-l bg-amber-50/40 p-1 align-middle text-slate-700">
                    <div className="flex items-center justify-between gap-1">
                      <div className="min-w-0 flex-1">
                        {row.noteS2 ? (
                          <ExpandableNote note={row.noteS2} />
                        ) : canEdit ? (
                          <button
                            type="button"
                            onClick={() => openEditNote(row)}
                            className="text-[10px] italic text-amber-700/70 hover:text-amber-900 hover:underline"
                            title="Bổ sung nhận xét S2"
                          >
                            + Nhận xét
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                      {canEdit && row.noteS2 && (
                        <button
                          type="button"
                          onClick={() => openEditNote(row)}
                          className="shrink-0 rounded p-0.5 text-[10px] text-amber-700 opacity-40 transition hover:bg-amber-200 hover:opacity-100"
                          title={`Chỉnh sửa nhận xét ngày ${fullDate(row.date)}`}
                        >
                          ✏️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>;
              })}
            </Fragment>)}
          </tbody>
        </table>
      </div>}
    </div>

    {editModal.isOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-extrabold text-[#20345f]">
                Thông số bổ sung ngày {fullDate(editModal.date)}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Nhập công suất khả dụng và nguyên nhân chênh lệch PPA
              </p>
            </div>
            <button
              type="button"
              disabled={editModal.saving}
              onClick={() => setEditModal(prev => ({ ...prev, isOpen: false }))}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              ✕
            </button>
          </div>

          {editModal.error && (
            <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
              {editModal.error}
            </p>
          )}

          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-bold text-blue-900">
                Công suất khả dụng S1 (MW)
                <input
                  value={editModal.availableCapacityS1Mw}
                  onChange={e => setEditModal(prev => ({ ...prev, availableCapacityS1Mw: e.target.value }))}
                  inputMode="decimal"
                  className="rounded-xl border border-blue-200 bg-blue-50/50 px-3 py-2.5 text-sm font-semibold text-black outline-none focus:border-[#4c78a8] focus:ring-2 focus:ring-[#4c78a8]/20"
                  placeholder="Ví dụ: 622,5"
                />
              </label>
              <label className="grid gap-1.5 text-xs font-bold text-amber-900">
                Công suất khả dụng S2 (MW)
                <input
                  value={editModal.availableCapacityS2Mw}
                  onChange={e => setEditModal(prev => ({ ...prev, availableCapacityS2Mw: e.target.value }))}
                  inputMode="decimal"
                  className="rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2.5 text-sm font-semibold text-black outline-none focus:border-[#4c78a8] focus:ring-2 focus:ring-[#4c78a8]/20"
                  placeholder="Ví dụ: 622,5"
                />
              </label>
            </div>
            <label className="grid gap-1.5 text-xs font-bold text-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-blue-900">Nhận xét / Nguyên nhân chênh lệch Tổ máy S1</span>
                <span className="font-normal text-slate-400">{editModal.noteS1.length}/1000 ký tự</span>
              </div>
              <textarea
                value={editModal.noteS1}
                onChange={e => setEditModal(prev => ({ ...prev, noteS1: e.target.value }))}
                rows={3}
                className="resize-y rounded-xl border border-slate-300 p-3 text-xs font-normal text-black outline-none focus:border-[#4c78a8] focus:ring-2 focus:ring-[#4c78a8]/20"
                placeholder="Ghi nhận tình trạng vận hành S1, độ tro/xỉ, máy nghiền, chất lượng than…"
              />
            </label>

            <label className="grid gap-1.5 text-xs font-bold text-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-amber-900">Nhận xét / Nguyên nhân chênh lệch Tổ máy S2</span>
                <span className="font-normal text-slate-400">{editModal.noteS2.length}/1000 ký tự</span>
              </div>
              <textarea
                value={editModal.noteS2}
                onChange={e => setEditModal(prev => ({ ...prev, noteS2: e.target.value }))}
                rows={3}
                className="resize-y rounded-xl border border-slate-300 p-3 text-xs font-normal text-black outline-none focus:border-[#4c78a8] focus:ring-2 focus:ring-[#4c78a8]/20"
                placeholder="Ghi nhận tình trạng vận hành S2, độ tro/xỉ, máy nghiền, chất lượng than…"
              />
            </label>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={editModal.saving}
              onClick={() => setEditModal(prev => ({ ...prev, isOpen: false }))}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={editModal.saving}
              onClick={handleSaveNote}
              className="rounded-xl bg-gradient-to-r from-[#4057b5] to-[#438ec1] px-5 py-2 text-xs font-bold text-white shadow-md hover:opacity-95 disabled:opacity-50"
            >
              {editModal.saving ? "Đang lưu…" : "Lưu thông tin"}
            </button>
          </div>
        </div>
      </div>
    )}
  </section>;
}
