"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Save,
  Search,
  Zap,
  Flame,
  Droplets,
  Boxes,
  Power,
  FileText,
  CheckCircle2,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Rows3,
  TableProperties,
  UserCheck,
  RefreshCw,
  Mail,
  Upload,
} from "lucide-react";
import { DateField } from "@/components/ui/date-field";
import { CtktktEmailModal } from "@/components/ctktkt-email-modal";
import { useSessionUser } from "@/components/session-context";
import { defaultOperatingDate } from "@/lib/operating-date";
import {
  canEditAnyCtktktField,
  canEditCtktktField,
  canEditCtktktGroup,
  getEditableCtktktGroups,
  CTKTKT_GROUP_META,
  type CtktktFieldGroup,
} from "@/lib/ctktkt-permissions";
import { CTKTKT_BCSX_LINKED_CELLS, CTKTKT_BCSX_LINKS } from "@/lib/ctktkt-bcsx-link";
import { CTKTKT_WATER_LINKED_CELLS, CTKTKT_WATER_LINKS } from "@/lib/ctktkt-water-link";
import {
  calculateCtktktSummary,
  calculateCtktktMeterSummary,
  calculateTkdDcsSummary,
  calculateOilDifferences,
  calculateOilEventSummary,
  calculateSteamDifferences,
  calculateNh3Summary,
  calculateNh3DcsSummary,
  calculateCoalShiftDetails,
  applyNh3StartLevelCarryover,
  NH3_DCS_START_METER_CELLS,
  NH3_START_LEVEL_CELLS,
  previousIsoDate,
  TKD_HOURS,
  OIL_HOURS,
  STEAM_HOURS,
  type CtktktDayEntries,
  type CtktktKpis,
} from "@/lib/ctktkt-report";
import { parseLocaleNumber } from "@/lib/ppa-heat-rate";
import { CTKTKT_INPUT_FIELDS } from "@/lib/ctktkt-fields.generated";
import {
  CTKTKT_EXTRA_INPUT_FIELDS,
  CTKTKT_LEGACY_UNUSED_COAL_BLEND_CELLS,
  normalizeCtktktInputValue,
} from "@/lib/ctktkt-extra-fields";
import { parseSpreadsheetClipboard } from "@/lib/spreadsheet-grid";
import { CTKTKT_INSTALLED_CAPACITY_CELL, CTKTKT_INSTALLED_CAPACITY_MW } from "@/lib/ctktkt-defaults";
import { findCtktktHistoryReadbackMismatch } from "@/lib/ctktkt-history-readback";
import { isQlktExtensionOutdated } from "@/lib/qlkt-extension-version";
import {
  PMIS_PRODUCTION_CELLS,
  sanitizeCtktktPmisSyncEntries,
} from "@/lib/ctktkt-pmis-sync";
import {
  CTKTKT_OIL_EVENT_CONFIG,
  type CtktktOilEventCode,
} from "@/lib/ctktkt-oil-event";

type LoadedEntry = { operatingDate: string; cell: string; value: string };
type LinkWarning = { operatingDate: string; cell: string; message: string };
type DisplayField = { cell: string; label: string; row: number; column: number };
type ImportEntry = { cell: string; value: string };
type ImportDay = { date: string; sheetName: string; manualEntries: ImportEntry[] };
type ImportPackage = {
  fileName: string;
  month: string;
  throughDay: number;
  days: ImportDay[];
  supportingDays?: ImportDay[];
  audits: Array<{ date: string; total: number; passed: number; failed: Array<{ name: string; sourceCell: string; expected: number | null; actual: number | null }> }>;
  totals: { failed: number; checks: number; passed: number; nonBlankManualValues: number; supportingValues?: number };
  warnings: Array<{ date: string; cell: string; message: string }>;
};

type MainTab =
  | "tkd_dcs"
  | "unit_meters"
  | "steam_nh3"
  | "td21_coal_blend"
  | "startup_shutdown"
  | "pmis_reports"
  | "all_fields";

type StartupUnit = "S1" | "S2";
type StartupEvent = CtktktOilEventCode;

const STARTUP_UNITS: Array<{ value: StartupUnit; label: string }> = [
  { value: "S1", label: "Tổ máy S1" },
  { value: "S2", label: "Tổ máy S2" },
];

const STARTUP_EVENTS: Array<{ value: StartupEvent; label: string }> = [
  { value: "startup", label: CTKTKT_OIL_EVENT_CONFIG.startup.label },
  { value: "shutdown", label: CTKTKT_OIL_EVENT_CONFIG.shutdown.label },
  { value: "incident_oil", label: CTKTKT_OIL_EVENT_CONFIG.incident_oil.label },
];

const QLKT_PRODUCTION_CELLS = new Set<string>(PMIS_PRODUCTION_CELLS);

const editableFields = [
  ...CTKTKT_INPUT_FIELDS.filter(
    field => !CTKTKT_BCSX_LINKED_CELLS.has(field.cell)
      && !CTKTKT_WATER_LINKED_CELLS.has(field.cell)
      && !NH3_DCS_START_METER_CELLS.has(field.cell)
      && !CTKTKT_LEGACY_UNUSED_COAL_BLEND_CELLS.has(field.cell),
  ),
  ...CTKTKT_EXTRA_INPUT_FIELDS,
];

const displayFields: DisplayField[] = [
  ...editableFields,
  ...CTKTKT_BCSX_LINKS.map(link => ({
    cell: link.cell,
    label: link.label,
    row: Number(link.cell.match(/\d+$/)?.[0] || 0),
    column: link.cell.charCodeAt(0) - 64,
  })),
  ...CTKTKT_WATER_LINKS.filter(link => !editableFields.some(f => f.cell === link.cell)).map(link => ({
    cell: link.cell,
    label: link.label,
    row: Number(link.cell.match(/\d+$/)?.[0] || 0),
    column: link.cell.charCodeAt(0) - 64,
  })),
].sort((a, b) => a.row - b.row || a.column - b.column);

const numberFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 });

function reportTabClass(active: boolean) {
  return `flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-center text-[13px] font-bold leading-snug transition-all ${
    active
      ? "border-[#765038] bg-[#8a6247] text-white shadow-sm"
      : "border-[#d9c3ad] bg-[#f4eadf] text-[#68462e] hover:border-[#b99472] hover:bg-[#ead9c8]"
  }`;
}

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

const meterComparisonKeys = new Set<keyof CtktktKpis>([
  "grossMwh",
  "netMwh",
  "auxiliaryMwh",
  "auxiliaryPercent",
]);

function format(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return numberFormat.format(value);
}

function parseDeminNum(val: string | undefined): number | null {
  if (!val || val.trim() === "") return null;
  const cleaned = val.trim().replace(/\s/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function formatDeminDiff(
  xVal: string | undefined,
  wVal: string | undefined,
  adjVal?: string | undefined,
): string {
  const x = parseDeminNum(xVal);
  const w = parseDeminNum(wVal);
  const adj = parseDeminNum(adjVal) ?? 0;
  if (x === null || w === null) return "—";
  return numberFormat.format(x - w + adj);
}

function formatDeminTotal(
  x1: string | undefined,
  w1: string | undefined,
  adj1: string | undefined,
  x2: string | undefined,
  w2: string | undefined,
  adj2: string | undefined,
): string {
  const nx1 = parseDeminNum(x1);
  const nw1 = parseDeminNum(w1);
  const nadj1 = parseDeminNum(adj1) ?? 0;
  const nx2 = parseDeminNum(x2);
  const nw2 = parseDeminNum(w2);
  const nadj2 = parseDeminNum(adj2) ?? 0;

  const diff1 = nx1 !== null && nw1 !== null ? nx1 - nw1 + nadj1 : null;
  const diff2 = nx2 !== null && nw2 !== null ? nx2 - nw2 + nadj2 : null;

  if (diff1 === null && diff2 === null) return "—";
  const total = (diff1 ?? 0) + (diff2 ?? 0);
  return numberFormat.format(total);
}

function formatAdjTotal(adj1: string | undefined, adj2: string | undefined): string {
  const a1 = parseDeminNum(adj1);
  const a2 = parseDeminNum(adj2);
  if (a1 === null && a2 === null) return "0";
  return numberFormat.format((a1 ?? 0) + (a2 ?? 0));
}

function formatResinTotal(z1: string | undefined, z2: string | undefined): string {
  const nz1 = parseDeminNum(z1);
  const nz2 = parseDeminNum(z2);
  if (nz1 === null && nz2 === null) return "—";
  const total = (nz1 ?? 0) + (nz2 ?? 0);
  return numberFormat.format(total);
}

function num(entries: CtktktDayEntries, cell: string): number | null {
  return parseLocaleNumber(entries[cell] || "");
}

export function CtktktReport() {
  const user = useSessionUser();
  const userCanEditAny = canEditAnyCtktktField(user);
  const editableGroups = useMemo(() => getEditableCtktktGroups(user), [user]);

  const [date, setDate] = useState(defaultOperatingDate);
  const [byDate, setByDate] = useState<Record<string, CtktktDayEntries>>({});
  const [linkedByDate, setLinkedByDate] = useState<Record<string, CtktktDayEntries>>({});
  const [linkWarnings, setLinkWarnings] = useState<LinkWarning[]>([]);

  // Tab điều hướng chính theo đúng các cụm phân công vận hành
  const [activeTab, setActiveTab] = useState<MainTab>("tkd_dcs");
  const [unitView, setUnitView] = useState<"s1" | "s2" | "both">("s1");
  const [isStartupExpanded, setIsStartupExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importingHistory, setImportingHistory] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [isKpiCollapsed, setIsKpiCollapsed] = useState(false);
  const [allViewMode, setAllViewMode] = useState<"dense" | "matrix" | "cards">("dense");
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [extensionVersion, setExtensionVersion] = useState("");
  const extensionOutdated = isQlktExtensionOutdated(extensionVersion);
  const [syncingPmis, setSyncingPmis] = useState(false);
  const pmisRequestRef = useRef<{ id: string; timer: number; operatingDate: string } | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const dirtyCellsRef = useRef(new Set<string>());

  useEffect(() => {
    const channel = "ctktkt-qlkt-sync";
    const handleMessage = async (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data as {
        channel?: string;
        sender?: string;
        type?: string;
        version?: string;
        requestId?: string;
        result?: {
          ok?: boolean;
          payload?: unknown;
          error?: string;
        };
      };
      if (!data || data.channel !== channel || data.sender !== "ctktkt-extension") return;
      if (data.type === "READY") {
        setExtensionVersion(String(data.version || "đã kết nối"));
        return;
      }
      const request = pmisRequestRef.current;
      if (!request || data.requestId !== request.id) return;
      if (data.type !== "SYNC_PMIS_02PD_RESULT") return;
      window.clearTimeout(request.timer);
      if (!data.result?.ok || !data.result.payload) {
        pmisRequestRef.current = null;
        setSyncingPmis(false);
        setError(data.result?.error || "Không đồng bộ được PMIS 02-PĐ từ QLKT.");
        return;
      }
      const payload = data.result.payload as {
        operatingDate?: string;
        entries?: Array<{ cell: string; value: string }>;
      };
      if (payload.operatingDate !== request.operatingDate || !Array.isArray(payload.entries)) {
        pmisRequestRef.current = null;
        setSyncingPmis(false);
        setError("Dữ liệu QLKT trả về không đúng ngày hoặc cấu trúc không hợp lệ.");
        return;
      }
      const safeEntries = sanitizeCtktktPmisSyncEntries(payload.entries);
      const receivedCells = new Set(safeEntries.map(entry => entry.cell));
      const missingProduction = PMIS_PRODUCTION_CELLS.filter(cell => !receivedCells.has(cell));
      if (missingProduction.length) {
        pmisRequestRef.current = null;
        setSyncingPmis(false);
        setError(`QLKT chưa trả đủ sản lượng ${missingProduction.join(", ")}; hệ thống không lưu dữ liệu thiếu.`);
        return;
      }
      const updates: Record<string, string> = {};
      for (const entry of safeEntries) {
        updates[entry.cell] = entry.value;
      }
      setByDate(old => ({
        ...old,
        [request.operatingDate]: {
          ...(old[request.operatingDate] || {}),
          ...updates,
        },
      }));
      try {
        const res = await fetch("/api/ctktkt-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operatingDate: request.operatingDate,
            entries: safeEntries,
          }),
        });
        const resJson = (await res.json()) as { error?: string; saved?: number };
        if (!res.ok || resJson.error) {
          throw new Error(resJson.error || "Không lưu được dữ liệu đồng bộ.");
        }
        for (const entry of safeEntries) dirtyCellsRef.current.delete(entry.cell);
        setDirty(dirtyCellsRef.current.size > 0);
        setMessage(`Đã đồng bộ và lưu thành công ${safeEntries.length} chỉ tiêu PMIS Sản lượng & 02-PĐ (hàng Duyên Hải 1) từ QLKT cho ngày ${request.operatingDate.split("-").reverse().join("/")}!`);
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Đã lấy dữ liệu nhưng không lưu được vào CSDL.");
      } finally {
        if (pmisRequestRef.current?.id === request.id) pmisRequestRef.current = null;
        setSyncingPmis(false);
      }
    };
    window.addEventListener("message", handleMessage);
    window.postMessage({ channel, sender: "ctktkt-web", type: "PING" }, window.location.origin);
    return () => {
      window.removeEventListener("message", handleMessage);
      if (pmisRequestRef.current) {
        window.clearTimeout(pmisRequestRef.current.timer);
        pmisRequestRef.current = null;
      }
    };
  }, []);

  const period = date.slice(0, 7);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/ctktkt-report?period=${encodeURIComponent(period)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async response => {
        const body = (await response.json()) as {
          entries?: LoadedEntry[];
          linkedEntries?: LoadedEntry[];
          warnings?: LinkWarning[];
          error?: string;
        };
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
      .catch(reason => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "Không tải được dữ liệu.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [period]);

  const previousDate = previousIsoDate(date);
  const previous = useMemo(() => {
    const manual = byDate[previousDate];
    const linked = linkedByDate[previousDate];
    return manual || linked ? { ...(manual || {}), ...(linked || {}) } : undefined;
  }, [byDate, linkedByDate, previousDate]);

  const current = useMemo(() => {
    const manual = byDate[date] || {};
    const linked = linkedByDate[date] || {};
    const combined = { ...linked, ...manual };
    // Nếu manual trống nhưng linked có giá trị tái sinh hạt từ Báo cáo lượng nước thì tự động link
    if ((manual["Z72"] === undefined || manual["Z72"] === "") && linked["Z72"] !== undefined) {
      combined["Z72"] = linked["Z72"];
    }
    if ((manual["Z73"] === undefined || manual["Z73"] === "") && linked["Z73"] !== undefined) {
      combined["Z73"] = linked["Z73"];
    }
    // Các ô liên kết từ BCSX luôn lấy từ linked (bị khóa tự động từ BCSX)
    for (const cell of CTKTKT_BCSX_LINKED_CELLS) {
      if (linked[cell] !== undefined) combined[cell] = linked[cell];
    }
    // Công suất đặt DH1 là thông số cố định của nhà máy, dùng làm giá trị mặc định
    // bất kể file hoặc QLKT trả về giá trị nào cho ô C181.
    combined[CTKTKT_INSTALLED_CAPACITY_CELL] = CTKTKT_INSTALLED_CAPACITY_MW;
    return applyNh3StartLevelCarryover(combined, previous);
  }, [byDate, linkedByDate, date, previous]);

  const startupUnit: StartupUnit | "" = current.STARTUP_UNIT === "S1" || current.STARTUP_UNIT === "S2"
    ? current.STARTUP_UNIT
    : "";
  const startupEvent: StartupEvent | "" = STARTUP_EVENTS.some(item => item.value === current.STARTUP_EVENT)
    ? current.STARTUP_EVENT as StartupEvent
    : "";
  const oilEventConfig = startupEvent ? CTKTKT_OIL_EVENT_CONFIG[startupEvent] : null;
  const oilEventSummary = startupEvent ? calculateOilEventSummary(current, startupEvent) : null;
  const canEditStartupMetadata = canEditCtktktField(user, "STARTUP_UNIT");

  const selectedWarnings = useMemo(
    () => linkWarnings.filter(item => item.operatingDate === date),
    [linkWarnings, date],
  );
  const linkedCount = Object.keys(linkedByDate[date] || {}).length;
  const hasPreviousManualData = Boolean(byDate[previousDate]);

  // Tính toán chỉ tiêu tổng hợp toàn nhà máy
  const summary = useMemo(
    () => calculateCtktktSummary(current, previous),
    [current, previous],
  );
  const meterSummary = useMemo(
    () => calculateCtktktMeterSummary(current, previous),
    [current, previous],
  );
  const coalShiftDetails = useMemo(
    () => calculateCoalShiftDetails(current, previous),
    [current, previous],
  );

  // Tính toán tự động Cụm 2 TKĐ DCS
  const tkdCalc = useMemo(() => calculateTkdDcsSummary(current), [current]);

  // Tính dầu theo chênh lệch tăng công tơ F1 và F2; mốc đầu ngày lấy từ D-1.
  const oilS1 = useMemo(() => calculateOilDifferences(current, "s1", previous), [current, previous]);
  const oilS2 = useMemo(() => calculateOilDifferences(current, "s2", previous), [current, previous]);

  // Tính toán lưu lượng hơi S1 và S2
  const steamS1 = useMemo(() => calculateSteamDifferences(current, "s1"), [current]);
  const steamS2 = useMemo(() => calculateSteamDifferences(current, "s2"), [current]);
  const nh3 = useMemo(
    () => calculateNh3Summary(current, summary.plant.grossMwh, summary.plant.netMwh),
    [current, summary.plant.grossMwh, summary.plant.netMwh],
  );
  const nh3Dcs = useMemo(() => calculateNh3DcsSummary(current, previous), [current, previous]);

  const update = (cell: string, value: string) => {
    setByDate(old => ({
      ...old,
      [date]: { ...(old[date] || {}), [cell]: value },
    }));
    dirtyCellsRef.current.add(cell);
    setDirty(true);
    setMessage("");
    setError("");
  };

  const save = async () => {
    if (!userCanEditAny) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const dirtyCells = [...dirtyCellsRef.current];
      const toSend = dirtyCells
        .filter(cell => canEditCtktktField(user, cell))
        .map(cell => ({ cell, value: current[cell] || "" }));
      if (!toSend.length) throw new Error("Không có ô dữ liệu nào vừa thay đổi để lưu.");

      const response = await fetch("/api/ctktkt-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operatingDate: date,
          entries: toSend,
        }),
      });
      const body = (await response.json()) as { saved?: number; error?: string };
      if (!response.ok) throw new Error(body.error || "Không lưu được dữ liệu.");

      // Đọc lại ngay từ CSDL để không báo thành công giả. Lỗi từng gặp ở cụm
      // NH3 là giao diện vẫn giữ số vừa nhập nhưng tải lại trang thì mất.
      const verifyResponse = await fetch(`/api/ctktkt-report?period=${period}`, { cache: "no-store" });
      const verifyBody = (await verifyResponse.json()) as { entries?: LoadedEntry[]; error?: string };
      if (!verifyResponse.ok) throw new Error(verifyBody.error || "Đã gửi dữ liệu nhưng chưa kiểm tra lại được CSDL.");
      const persisted = Object.fromEntries(
        (verifyBody.entries || [])
          .filter(entry => entry.operatingDate === date)
          .map(entry => [entry.cell, entry.value]),
      );
      const mismatches = toSend.filter(entry =>
        normalizeCtktktInputValue(entry.cell, persisted[entry.cell] || "")
          !== normalizeCtktktInputValue(entry.cell, entry.value),
      );
      if (mismatches.length) {
        throw new Error(`CSDL chưa giữ đúng ${mismatches.length} ô (${mismatches.slice(0, 6).map(entry => entry.cell).join(", ")}). Chưa xác nhận lưu thành công.`);
      }
      setByDate(old => ({ ...old, [date]: persisted }));
      for (const entry of toSend) dirtyCellsRef.current.delete(entry.cell);
      setDirty(dirtyCellsRef.current.size > 0);
      setMessage(
        `Đã lưu thành công ${body.saved || 0} ô dữ liệu ngày ${date.split("-").reverse().join("/")}.`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không lưu được dữ liệu.");
    } finally {
      setSaving(false);
    }
  };

  const syncPmis02PdFromQlkt = () => {
    setError("");
    setMessage("");
    if (!canEditCtktktGroup(user, "pmis_reports") && !userCanEditAny) {
      setError("Tài khoản chưa được phân quyền cập nhật nhóm Báo cáo PMIS 02-PĐ.");
      return;
    }
    if (!extensionVersion) {
      window.postMessage({ channel: "ctktkt-qlkt-sync", sender: "ctktkt-web", type: "PING" }, window.location.origin);
      setError(`Chưa kết nối tiện ích QLKT. Hãy mở trang quản lý tiện ích, kiểm tra tiện ích đang bật rồi Ctrl+F5 trang web.`);
      return;
    }
    if (pmisRequestRef.current) window.clearTimeout(pmisRequestRef.current.timer);
    const requestId = crypto.randomUUID();
    const timer = window.setTimeout(() => {
      if (pmisRequestRef.current?.id !== requestId) return;
      pmisRequestRef.current = null;
      setSyncingPmis(false);
      setError("QLKT phản hồi quá lâu. Chưa ghi dữ liệu; hãy kiểm tra phiên đăng nhập QLKT rồi thử lại.");
    }, 180000);
    pmisRequestRef.current = { id: requestId, timer, operatingDate: date };
    setSyncingPmis(true);
    setMessage("Đang mở và đọc màn hình Sản lượng và 02-PĐ (hàng Duyên Hải 1) từ QLKT…");
    window.postMessage({
      channel: "ctktkt-qlkt-sync",
      sender: "ctktkt-web",
      type: "SYNC_PMIS_02PD",
      requestId,
      operatingDate: date,
    }, window.location.origin);
  };

  const handleHistoryImport = async (file: File | undefined) => {
    if (!file || !userCanEditAny) return;
    setImportingHistory(true);
    setError("");
    setMessage("");
    const completed: ImportDay[] = [];
    let backup: { reports: Record<string, { entries?: LoadedEntry[] }>; importedDays: ImportDay[] } | null = null;

    const postJson = async (url: string, body: unknown) => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok || result.error) throw new Error(result.error || `Không ghi được ${url}.`);
    };

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("targetDate", date);
      const parseResponse = await fetch("/api/ctktkt-report/history-import", { method: "POST", body: formData });
      const parsed = (await parseResponse.json()) as Partial<ImportPackage> & { error?: string };
      if (!parseResponse.ok || parsed.error) throw new Error(parsed.error || "Không đọc được file Chỉ tiêu KTKT.");
      if (!/^\d{4}-\d{2}$/.test(parsed.month || "") || !Array.isArray(parsed.days) || !parsed.days.length || !parsed.totals) throw new Error("File không đúng cấu trúc Chỉ tiêu KTKT.");
      const importPackage = parsed as ImportPackage;
      if (importPackage.days.length !== 1 || importPackage.days[0]?.date !== date) {
        throw new Error(`File không trả đúng dữ liệu của ngày ${date.split("-").reverse().join("/")}.`);
      }
      if (importPackage.totals.nonBlankManualValues <= 0) {
        throw new Error(`Sheet ${importPackage.days[0].sheetName} không có dữ liệu nhập tay để tải lên.`);
      }
      if (importPackage.totals.checks <= 0) {
        throw new Error(`Sheet ${importPackage.days[0].sheetName} không có kết quả tự tính để đối chiếu.`);
      }
      for (const day of importPackage.days) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !Array.isArray(day.manualEntries) || day.manualEntries.length > 400) {
          throw new Error(`Dữ liệu ngày ${day.date || "không rõ"} không hợp lệ.`);
        }
      }
      const supportingDays = importPackage.supportingDays || [];
      for (const day of supportingDays) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !Array.isArray(day.manualEntries) || day.manualEntries.length > 8) {
          throw new Error(`Dữ liệu công tơ hỗ trợ ngày ${day.date || "không rõ"} không hợp lệ.`);
        }
      }

      if (importPackage.totals.failed > 0 || importPackage.totals.checks !== importPackage.totals.passed) {
        const failures = importPackage.audits.flatMap(audit => audit.failed.map(item =>
          `${audit.date.split("-").reverse().join("/")} · ${item.name} (${item.sourceCell}): Excel=${item.expected ?? "trống"}, Web=${item.actual ?? "trống"}`,
        ));
        throw new Error(`Chưa nhập ngày ${date.split("-").reverse().join("/")} vì có ${importPackage.totals.failed}/${importPackage.totals.checks} kết quả tự tính chưa khớp:\n${failures.slice(0, 12).join("\n")}${failures.length > 12 ? `\n… và ${failures.length - 12} sai lệch khác.` : ""}`);
      }
      const confirmed = window.confirm(
        `Ngày ${date.split("-").reverse().join("/")} đã khớp 100% (${importPackage.totals.passed}/${importPackage.totals.checks} kết quả tự tính).\n\nChỉ ${importPackage.totals.nonBlankManualValues || importPackage.days[0].manualEntries.filter(entry => entry.value).length} ô nhập tay từ sheet ${importPackage.days[0].sheetName} sẽ được ghi.${supportingDays.length ? ` Ghi kèm ${importPackage.totals.supportingValues || supportingDays[0].manualEntries.length} chỉ số công tơ 24h từ sheet D-1 để tính cột Công tơ/Excel.` : ""} Các ô tự tính và ô liên kết không bị ghi đè.${importPackage.warnings.length ? `\nCó ${importPackage.warnings.length} ô trong vùng nhập tay chứa công thức nên đã bỏ qua.` : ""}\n\nTiếp tục nhập dữ liệu?`,
      );
      if (!confirmed) {
        setMessage(`Ngày ${date.split("-").reverse().join("/")} đã khớp 100%. Bạn đã chọn chưa ghi dữ liệu.`);
        return;
      }

      const writeDays = [...supportingDays, ...importPackage.days];
      const periods = [...new Set(writeDays.map(day => day.date.slice(0, 7)))];
      const reports: Record<string, { entries?: LoadedEntry[] }> = {};
      for (const backupPeriod of periods) {
        const response = await fetch(`/api/ctktkt-report?period=${encodeURIComponent(backupPeriod)}`, { cache: "no-store" });
        const body = (await response.json()) as { entries?: LoadedEntry[]; error?: string };
        if (!response.ok) throw new Error(body.error || `Không sao lưu được dữ liệu tháng ${backupPeriod}.`);
        reports[backupPeriod] = body;
      }
      backup = { reports, importedDays: importPackage.days };
      const backupBlob = new Blob([JSON.stringify({ createdAt: new Date().toISOString(), ...backup }, null, 2)], { type: "application/json" });
      const backupUrl = URL.createObjectURL(backupBlob);
      const backupLink = document.createElement("a");
      backupLink.href = backupUrl;
      backupLink.download = `CTKTKT_BACKUP_${importPackage.month}.json`;
      backupLink.click();
      URL.revokeObjectURL(backupUrl);

      for (const day of writeDays) {
        completed.push(day);
        await postJson("/api/ctktkt-report", { operatingDate: day.date, entries: day.manualEntries });
      }

      let verifiedByPeriod: Record<string, { entries?: LoadedEntry[]; linkedEntries?: LoadedEntry[]; warnings?: LinkWarning[] }> = {};
      let readbackMismatch: ReturnType<typeof findCtktktHistoryReadbackMismatch> = null;
      for (let attempt = 1; attempt <= 6; attempt += 1) {
        verifiedByPeriod = {};
        for (const verifyPeriod of periods) {
          const response = await fetch(`/api/ctktkt-report?period=${encodeURIComponent(verifyPeriod)}&verify=${Date.now()}`, { cache: "no-store" });
          const body = (await response.json()) as { entries?: LoadedEntry[]; linkedEntries?: LoadedEntry[]; warnings?: LinkWarning[]; error?: string };
          if (!response.ok) throw new Error(body.error || `Không đọc lại được dữ liệu tháng ${verifyPeriod}.`);
          verifiedByPeriod[verifyPeriod] = body;
        }
        readbackMismatch = findCtktktHistoryReadbackMismatch(
          writeDays,
          Object.values(verifiedByPeriod).flatMap(body => body.entries || []),
        );
        if (!readbackMismatch) break;
        if (attempt < 6) await new Promise(resolve => window.setTimeout(resolve, 750));
      }
      if (readbackMismatch) {
        throw new Error(
          `Đọc lại không khớp ô ${readbackMismatch.cell}, ngày ${readbackMismatch.date}: `
          + `file=${readbackMismatch.expected || "trống"}, web=${readbackMismatch.actual ?? "trống"}.`,
        );
      }

      const verified = verifiedByPeriod[importPackage.month];
      const next: Record<string, CtktktDayEntries> = {};
      for (const entry of verified.entries || []) {
        next[entry.operatingDate] ||= {};
        next[entry.operatingDate][entry.cell] = entry.value;
      }
      const nextLinked: Record<string, CtktktDayEntries> = {};
      for (const entry of verified.linkedEntries || []) {
        nextLinked[entry.operatingDate] ||= {};
        nextLinked[entry.operatingDate][entry.cell] = entry.value;
      }
      setByDate(next);
      setLinkedByDate(nextLinked);
      setLinkWarnings(verified.warnings || []);
      setDate(importPackage.days[0].date);
      dirtyCellsRef.current.clear();
      setDirty(false);
      setMessage(`Đã nhập ngày ${date.split("-").reverse().join("/")} từ sheet ${importPackage.days[0].sheetName}; chỉ ghi ô nhập tay; dữ liệu tự tính trên web và file đã khớp 100% (${importPackage.totals.passed}/${importPackage.totals.checks}).`);
    } catch (reason) {
      let rollbackMessage = "";
      if (backup && completed.length) {
        try {
          const oldByDate = new Map<string, Record<string, string>>();
          for (const body of Object.values(backup.reports)) for (const entry of body.entries || []) {
            const values = oldByDate.get(entry.operatingDate) || {};
            values[entry.cell] = entry.value;
            oldByDate.set(entry.operatingDate, values);
          }
          for (const day of [...completed].reverse()) {
            const oldManual = oldByDate.get(day.date) || {};
            await postJson("/api/ctktkt-report", {
              operatingDate: day.date,
              entries: day.manualEntries.map(entry => ({ cell: entry.cell, value: oldManual[entry.cell] || "" })),
            });
          }
          rollbackMessage = " Đã hoàn nguyên các ngày đã ghi.";
        } catch {
          rollbackMessage = " Hoàn nguyên tự động không trọn vẹn; dùng file CTKTKT_BACKUP vừa tải để phục hồi.";
        }
      }
      setError(`${reason instanceof Error ? reason.message : "Không nhập được dữ liệu lịch sử."}${rollbackMessage}`);
    } finally {
      setImportingHistory(false);
      if (importFileRef.current) importFileRef.current.value = "";
    }
  };

  // Điều hướng bằng bàn phím (Phím mũi tên ← ↑ → ↓, Enter, Tab) tương tự Excel
  const navigateCell = (
    currentInput: HTMLInputElement,
    direction: "up" | "down" | "left" | "right",
  ) => {
    const table = currentInput.closest("table");
    if (!table) return;

    const allRows = Array.from(table.querySelectorAll("tr"));
    const inputRows = allRows.filter(tr => tr.querySelector("input[data-cell]"));

    const currentTr = currentInput.closest("tr");
    if (!currentTr) return;
    const currentRowIdx = inputRows.indexOf(currentTr);
    if (currentRowIdx === -1) return;

    const editableInputs = (row: HTMLTableRowElement) => Array.from(
      row.querySelectorAll<HTMLInputElement>('input[data-cell][data-editable="true"]:not(:disabled)'),
    );
    const cellIndex = (input: HTMLInputElement) => input.closest<HTMLTableCellElement>("td,th")?.cellIndex ?? -1;
    const currentInputsInRow = editableInputs(currentTr);
    const currentInputIdx = currentInputsInRow.indexOf(currentInput);
    const currentCellIndex = cellIndex(currentInput);
    if (currentInputIdx === -1 || currentCellIndex === -1) return;

    let targetInput: HTMLInputElement | null = null;

    if (direction === "down") {
      for (let r = currentRowIdx + 1; r < inputRows.length; r++) {
        const rowInputs = editableInputs(inputRows[r]);
        const candidate = rowInputs.find(input => cellIndex(input) === currentCellIndex)
          || [...rowInputs].sort((a, b) => Math.abs(cellIndex(a) - currentCellIndex) - Math.abs(cellIndex(b) - currentCellIndex))[0];
        if (candidate) {
          targetInput = candidate;
          break;
        }
      }
    } else if (direction === "up") {
      for (let r = currentRowIdx - 1; r >= 0; r--) {
        const rowInputs = editableInputs(inputRows[r]);
        const candidate = rowInputs.find(input => cellIndex(input) === currentCellIndex)
          || [...rowInputs].sort((a, b) => Math.abs(cellIndex(a) - currentCellIndex) - Math.abs(cellIndex(b) - currentCellIndex))[0];
        if (candidate) {
          targetInput = candidate;
          break;
        }
      }
    } else if (direction === "right") {
      targetInput = currentInputsInRow[currentInputIdx + 1] || null;
      if (!targetInput) {
        for (let r = currentRowIdx + 1; r < inputRows.length; r++) {
          const rowInputs = editableInputs(inputRows[r]);
          const candidate = rowInputs[0];
          if (candidate) {
            targetInput = candidate;
            break;
          }
        }
      }
    } else if (direction === "left") {
      targetInput = currentInputsInRow[currentInputIdx - 1] || null;
      if (!targetInput) {
        for (let r = currentRowIdx - 1; r >= 0; r--) {
          const candidates = editableInputs(inputRows[r]);
          if (candidates.length > 0) {
            targetInput = candidates[candidates.length - 1];
            break;
          }
        }
      }
    }

    if (targetInput) {
      targetInput.focus();
      targetInput.select();
    }
  };

  const handleCellKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const input = e.currentTarget;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      navigateCell(input, "down");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      navigateCell(input, "up");
    } else if (e.key === "Enter") {
      e.preventDefault();
      navigateCell(input, e.shiftKey ? "up" : "down");
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      navigateCell(input, "right");
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      navigateCell(input, "left");
    } else if (e.key === "Tab") {
      e.preventDefault();
      navigateCell(input, e.shiftKey ? "left" : "right");
    }
  };

  // Dán dữ liệu nhiều ô cùng lúc từ Excel / Google Sheets (ngăn cách bằng Tab và Xuống dòng)
  const handleCellPaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    startCell: string,
  ) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;

    // Chỉ can thiệp nếu clipboard chứa tab hoặc xuống dòng (dữ liệu nhiều ô)
    if (!text.includes("\t") && !text.includes("\n") && !text.includes("\r")) {
      return;
    }

    e.preventDefault();

    const rows = parseSpreadsheetClipboard(text);
    if (rows.length === 0) return;

    const currentInput = e.currentTarget;
    const table = currentInput.closest("table");
    if (!table) {
      const firstVal = rows[0]?.[0];
      if (firstVal !== undefined) update(startCell, firstVal);
      return;
    }

    const allRows = Array.from(table.querySelectorAll("tr"));
    const inputRows = allRows.filter(tr => tr.querySelector("input[data-cell]"));

    const currentTr = currentInput.closest("tr");
    if (!currentTr) return;
    const startRowIdx = inputRows.indexOf(currentTr);
    if (startRowIdx === -1) return;

    const currentInputsInRow = Array.from(currentTr.querySelectorAll<HTMLInputElement>("input[data-cell]"));
    const currentEditableInputs = currentInputsInRow.filter(input => input.dataset.editable === "true" && !input.disabled);
    const startEditableIdx = currentEditableInputs.indexOf(currentInput);
    if (startEditableIdx === -1) return;
    const startVisualCol = currentInput.closest<HTMLTableCellElement>("td,th")?.cellIndex ?? -1;
    const widestClipboardRow = Math.max(...rows.map(row => row.length));
    const compactCapacity = currentEditableInputs.length - startEditableIdx;
    const useVisualColumns = startVisualCol >= 0 && widestClipboardRow > compactCapacity;

    const updates: Record<string, string> = {};
    let count = 0;

    for (let r = 0; r < rows.length; r++) {
      const targetRowIdx = startRowIdx + r;
      if (targetRowIdx >= inputRows.length) break;

      const targetTr = inputRows[targetRowIdx];
      const targetInputs = Array.from(
        targetTr.querySelectorAll<HTMLInputElement>("input[data-cell]"),
      );
      const targetEditableInputs = targetInputs.filter(input => input.dataset.editable === "true" && !input.disabled);

      const rowValues = rows[r];
      for (let c = 0; c < rowValues.length; c++) {
        const targetInput = useVisualColumns
          ? targetInputs.find(input => input.closest<HTMLTableCellElement>("td,th")?.cellIndex === startVisualCol + c)
          : targetEditableInputs[startEditableIdx + c];
        if (!targetInput) continue;
        const cellName = targetInput.getAttribute("data-cell");
        const isEditable = targetInput.getAttribute("data-editable") === "true";

        if (cellName && isEditable && !targetInput.disabled) {
          updates[cellName] = rowValues[c];
          count++;
        }
      }
    }

    if (count > 0) {
      setByDate(old => ({
        ...old,
        [date]: { ...(old[date] || {}), ...updates },
      }));
      for (const cell of Object.keys(updates)) dirtyCellsRef.current.add(cell);
      setDirty(true);
      setMessage(`Đã dán thành công ${count} ô từ bảng tính vào ngày ${date.split("-").reverse().join("/")}.`);
      setError("");
    }
  };

  // Helper render ô nhập liệu có kiểm tra quyền và giao diện rõ ràng
  const renderCellInput = (
    cell: string,
    options?: {
      placeholder?: string;
      className?: string;
      isNumber?: boolean;
      group?: CtktktFieldGroup;
      compact?: boolean;
      maxLength?: number;
    },
  ) => {
    const isWaterLinked = CTKTKT_WATER_LINKED_CELLS.has(cell);
    const isQlktProduction = QLKT_PRODUCTION_CELLS.has(cell);
    const isFixed = cell === CTKTKT_INSTALLED_CAPACITY_CELL;
    const isNh3Carryover = NH3_START_LEVEL_CELLS.has(cell);
    const isLinked = CTKTKT_BCSX_LINKED_CELLS.has(cell) || isWaterLinked || isQlktProduction || isFixed || isNh3Carryover;
    const canEditThis = !isLinked && canEditCtktktField(user, cell);
    const value = current[cell] || "";

    const groupMeta = options?.group ? CTKTKT_GROUP_META[options.group] : null;
    const tooltip = isLinked
      ? isFixed
        ? `${cell}: Công suất đặt cố định của NMNĐ Duyên Hải 1 (${CTKTKT_INSTALLED_CAPACITY_MW} MW)`
        : isNh3Carryover
          ? `${cell}: Tự động lấy từ mức 24h ngày D-1`
          : `${cell}: Liên kết tự động từ ${isQlktProduction ? "QLKT · Sản lượng" : isWaterLinked ? "Theo dõi lượng nước" : "BCSX mục 1"}`
      : canEditThis
        ? `${cell}: Bạn có quyền nhập liệu (Phím mũi tên để chuyển ô, Ctrl+V để dán nhiều ô)`
        : `${cell}: Khóa (Chỉ ${groupMeta?.responsible || "cương vị được phân công"} nhập)`;

    return (
      <div className="relative flex items-center justify-center">
        <input
          data-cell={cell}
          data-editable={canEditThis ? "true" : "false"}
          disabled={!canEditThis || loading || saving}
          inputMode={options?.isNumber === false ? "text" : "decimal"}
          maxLength={options?.maxLength}
          value={value}
          onChange={e => update(cell, e.target.value)}
          onFocus={e => e.currentTarget.select()}
          onKeyDown={handleCellKeyDown}
          onPaste={e => handleCellPaste(e, cell)}
          placeholder={options?.placeholder || "—"}
          title={tooltip}
          className={`h-7 w-full rounded border px-1.5 text-right font-mono text-xs font-bold tabular-nums outline-none transition-all ${
            isLinked
              ? "border-blue-200 bg-blue-50/80 text-blue-900 cursor-not-allowed"
              : canEditThis
                ? "border-slate-300 bg-white text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 shadow-2xs hover:border-indigo-400"
                : "border-slate-200 bg-slate-100/90 text-slate-500 cursor-not-allowed"
          } ${options?.className || ""}`}
        />
        {!canEditThis && !isLinked && (
          <Lock
            className="pointer-events-none absolute right-1.5 top-2 size-3 text-slate-400"
            aria-hidden="true"
          />
        )}
      </div>
    );
  };

  // Danh tính và thông báo cương vị người dùng
  const userRoleDescription = useMemo(() => {
    if (!user) return "Chưa đăng nhập (Chỉ xem)";
    const pos = user.position || "";
    const isLeader =
      user.role === "admin" ||
      user.role === "supervisor" ||
      user.role === "technician" ||
      user.role === "editor" ||
      pos.toLowerCase().includes("trưởng ca") ||
      pos.toLowerCase().includes("quản đốc");

    if (isLeader) {
      return "Toàn quyền quản lý, nhập liệu và phê duyệt số liệu";
    }

    if (editableGroups.length === 0) {
      return "Chế độ chỉ xem (Không có quyền nhập cho cương vị này)";
    }

    return `Quyền nhập: ${editableGroups.map(g => CTKTKT_GROUP_META[g]?.shortLabel).join(", ")}`;
  }, [user, editableGroups]);

  return (
    <section className="mx-auto grid w-full min-w-0 max-w-full gap-3 xl:max-w-[1600px]">
      {/* 1. THANH TIÊU ĐỀ, CHỌN NGÀY VÀ ĐIỀU HÀNH */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-indigo-800 uppercase">
                Báo cáo gốc · Tự tính theo công thức
              </span>
              <span className="text-xs text-slate-400">|</span>
              <span className="text-xs font-semibold text-slate-500">
                PXVH1 · Phân quyền theo Cương vị
              </span>
            </div>
            <h1 className="mt-1 text-xl font-black text-[#173b64]">
              Chỉ tiêu kinh tế kỹ thuật NMNĐ Duyên Hải 1
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <span>Ngày báo cáo / nhập file:</span>
              <DateField
                value={date}
                disabled={saving || importingHistory || syncingPmis}
                onChange={value => {
                  if (value.slice(0, 7) !== period) setLoading(true);
                  setDate(value);
                  dirtyCellsRef.current.clear();
                  setDirty(false);
                  setMessage("");
                  setError("");
                }}
                className="w-36"
              />
            </label>

            <input
              ref={importFileRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={event => void handleHistoryImport(event.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => importFileRef.current?.click()}
              disabled={!userCanEditAny || importingHistory || loading}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-[#c6a17d] bg-[#f3e8dc] px-3 text-xs font-bold text-[#70492d] shadow-xs transition-all hover:bg-[#ead8c5] disabled:opacity-45"
              title={`Tự tìm sheet ngày ${date.slice(8, 10)}; chỉ lấy ô nhập tay, đối chiếu kết quả tự tính và chỉ ghi khi khớp 100%`}
            >
              <Upload className="size-3.5" />
              {importingHistory ? "Đang kiểm tra file…" : `Nhập file ngày ${date.split("-").reverse().join("/")}`}
            </button>

            <button
              type="button"
              onClick={save}
              disabled={!userCanEditAny || saving || loading || !dirty}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-[#4057b5] px-4 text-xs font-bold text-white shadow-xs transition-all hover:bg-[#334694] disabled:opacity-45"
            >
              <Save className="size-3.5" />
              {saving ? "Đang lưu…" : "Lưu số liệu"}
            </button>

            <a
              href={`/api/ctktkt-report/export?period=${encodeURIComponent(period)}`}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-emerald-800"
            >
              <Download className="size-3.5" />
              Xuất Excel tháng
            </a>

            <button
              type="button"
              onClick={() => setShowEmailModal(true)}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-blue-700 active:scale-95"
              title="Mở mẫu báo cáo gửi mail hàng ngày font Times New Roman theo file chỉ tiêu"
            >
              <Mail className="size-3.5" />
              Báo cáo gửi mail
            </button>
          </div>
        </div>

        {/* Banner thông tin cương vị & phân quyền */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-100 bg-[#f5f8ff] px-3.5 py-2 text-xs text-[#1e3a8a]">
          <div className="flex flex-wrap items-center gap-2">
            <UserCheck className="size-4 text-indigo-700 shrink-0" />
            <span className="font-bold text-slate-800">
              {user?.displayName || "Khách"}
            </span>
            {user?.position && (
              <span className="rounded-md bg-indigo-100 px-2 py-0.5 font-bold text-indigo-800">
                {user.position}
              </span>
            )}
            <span className="text-slate-400">·</span>
            <span className="font-medium text-slate-600">{userRoleDescription}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-500">
            <span className="flex items-center gap-1">
              <span className="inline-block size-2 rounded-full bg-blue-500"></span>
              Ô xanh: Lấy từ BCSX
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block size-2 rounded-full bg-indigo-600"></span>
              Ô trắng: Nhập tay
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block size-2 rounded-full bg-slate-300"></span>
              Ô xám/khóa: Tự tính / Cương vị khác
            </span>
            <span className="flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-indigo-800">
              ⌨️ Phím mũi tên (← ↑ → ↓) / Enter để chuyển ô · Dán Ctrl+V nhiều ô từ Excel
            </span>
          </div>
        </div>

        {!hasPreviousManualData && !loading && (
          <p className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
            Chưa có chỉ số ngày trước ({previousDate}), các giá trị chênh lệch công tơ tạm
            hiển thị “—”. Hãy nhập ngày trước trước khi chốt báo cáo.
          </p>
        )}
        {selectedWarnings.map(item => (
          <p
            key={`${item.cell}-${item.message}`}
            role="alert"
            className="mt-2 whitespace-pre-line rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-800"
          >
            {item.message}
          </p>
        ))}
        {error && (
          <p
            role="alert"
            className="mt-2 whitespace-pre-line rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-800"
          >
            {error}
          </p>
        )}
        {message && (
          <p
            role="status"
            className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900"
          >
            {message}
          </p>
        )}
      </div>

      {/* 2. BẢNG KẾT QUẢ TÍNH TỰ ĐỘNG KPI & Ô NHẬP TAY CỤM 1 (I35, I36) */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between border-b bg-[#f8faff] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-black text-[#173b64] uppercase tracking-wider">
              Cụm 1 · Thống kê chỉ tiêu KTKT NMNĐ Duyên Hải 1
            </h2>
            <span className="text-[11px] text-slate-500">
              (PMIS là số liệu chính · Công tơ chỉ đối chiếu · Nhập I35, I36)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEmailModal(true)}
              className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100"
              title="Mở mẫu báo cáo gửi mail hàng ngày font Times New Roman theo file chỉ tiêu"
            >
              <Mail className="size-3" />
              Mẫu gửi mail
            </button>
            <button
              type="button"
              onClick={() => setIsKpiCollapsed(prev => !prev)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-200/60"
            >
            {isKpiCollapsed ? (
              <>
                <span>Mở rộng KPI</span>
                <ChevronDown className="size-3.5" />
              </>
            ) : (
              <>
                <span>Thu gọn KPI</span>
                <ChevronUp className="size-3.5" />
              </>
            )}
            </button>
          </div>
        </div>

        {!isKpiCollapsed ? (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-[#e9f2fa] text-[#173b64]">
                    <th rowSpan={2} className="p-2 text-left font-bold">Chỉ tiêu KTKT</th>
                    <th colSpan={2} className="p-2 text-center font-bold">Tổ máy S1</th>
                    <th colSpan={2} className="p-2 text-center font-bold">Tổ máy S2</th>
                    <th colSpan={2} className="p-2 text-center font-bold">Toàn Nhà máy</th>
                    <th rowSpan={2} className="p-2 text-center font-bold">Đơn vị</th>
                  </tr>
                  <tr className="border-b bg-[#f4f8fc] text-[10px] font-bold text-slate-600">
                    <th className="p-1.5 text-right">PMIS/QLKT</th>
                    <th className="p-1.5 text-right">Công tơ/Excel</th>
                    <th className="p-1.5 text-right">PMIS/QLKT</th>
                    <th className="p-1.5 text-right">Công tơ/Excel</th>
                    <th className="p-1.5 text-right">PMIS/QLKT</th>
                    <th className="p-1.5 text-right">Công tơ/Excel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metricRows.map(row => (
                    <tr key={row.key} className="hover:bg-slate-50/70">
                      <td className="p-2 font-medium text-slate-800">{row.label}</td>
                      <td className="bg-cyan-50/30 p-2 text-right font-bold font-mono tabular-nums text-[#173b64]">
                        {format(summary.s1[row.key])}
                      </td>
                      <td className="bg-amber-50/40 p-2 text-right font-mono tabular-nums text-amber-900">
                        {meterComparisonKeys.has(row.key) ? format(meterSummary.s1[row.key]) : "—"}
                      </td>
                      <td className="bg-cyan-50/30 p-2 text-right font-bold font-mono tabular-nums text-[#173b64]">
                        {format(summary.s2[row.key])}
                      </td>
                      <td className="bg-amber-50/40 p-2 text-right font-mono tabular-nums text-amber-900">
                        {meterComparisonKeys.has(row.key) ? format(meterSummary.s2[row.key]) : "—"}
                      </td>
                      <td className="bg-blue-50/40 p-2 text-right font-black font-mono tabular-nums text-indigo-900">
                        {format(summary.plant[row.key])}
                      </td>
                      <td className="bg-amber-50/40 p-2 text-right font-mono tabular-nums text-amber-900">
                        {meterComparisonKeys.has(row.key) ? format(meterSummary.plant[row.key]) : "—"}
                      </td>
                      <td className="p-2 text-center font-medium text-slate-500">{row.unit}</td>
                    </tr>
                  ))}
                  {/* Hai ô nhập tay duy nhất của Cụm 1 */}
                  <tr className="bg-amber-50/30 border-t-2 border-amber-200">
                    <td className="p-2 font-bold text-amber-950">
                      Suất hao bi nghiền than (Ô I35)
                    </td>
                    <td colSpan={4} className="p-2 text-xs text-slate-500 italic">
                      Mặc định 150 g/tấn than (Trưởng kíp điện / Thống kê nhập)
                    </td>
                    <td colSpan={2} className="p-1.5 text-right w-36">
                      {renderCellInput("I35", {
                        placeholder: "150",
                        group: "kpi_summary",
                      })}
                    </td>
                    <td className="p-2 text-center text-slate-600 font-bold">g/tấn than</td>
                  </tr>
                  <tr className="bg-amber-50/30">
                    <td className="p-2 font-bold text-amber-950">
                      Lượng than nhập trong ngày (Ô I36)
                    </td>
                    <td colSpan={4} className="p-2 text-xs text-slate-500 italic">
                      Cộng dồn vào lượng than tồn kho ngày D
                    </td>
                    <td colSpan={2} className="p-1.5 text-right w-36">
                      {renderCellInput("I36", {
                        placeholder: "0",
                        group: "kpi_summary",
                      })}
                    </td>
                    <td className="p-2 text-center text-slate-600 font-bold">tấn</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 bg-slate-50 px-4 py-2 text-xs">
            <span>
              Điện đầu cực: <b>S1 {format(summary.s1.grossMwh)}</b> /{" "}
              <b>S2 {format(summary.s2.grossMwh)} MWh</b>
            </span>
            <span>
              Than quy ẩm: <b>{format(summary.plant.adjustedCoalTonnes)} tấn</b>
            </span>
            <span>
              Suất hao than: <b>{format(summary.plant.netCoalRate)} g/kWh</b>
            </span>
            <span>
              Suất hao nhiệt: <b>{format(summary.plant.netHeatRate)} kJ/kWh</b>
            </span>
          </div>
        )}
      </div>

      {/* 3. TABS ĐIỀU HƯỚNG CÁC CỤM VẬN HÀNH (THIẾT KẾ RÕ RÀNG THEO CƯƠNG VỊ) */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="grid grid-cols-1 gap-1.5 border-b bg-[#fbf7f2] p-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 2xl:grid-cols-[repeat(6,minmax(0,1fr))_minmax(150px,0.78fr)]">
          <button
            type="button"
            onClick={() => setActiveTab("tkd_dcs")}
            className={reportTabClass(activeTab === "tkd_dcs")}
          >
            <Zap className="size-4 shrink-0" />
            <span>DCS P/Q/U và lượng nước 24h</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("unit_meters")}
            className={reportTabClass(activeTab === "unit_meters")}
          >
            <Power className="size-4 shrink-0" />
            <span>Công tơ điện/than/dầu</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("steam_nh3")}
            className={reportTabClass(activeTab === "steam_nh3")}
          >
            <Droplets className="size-4 shrink-0" />
            <span>Tiêu hao hơi và NH3</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("td21_coal_blend")}
            className={reportTabClass(activeTab === "td21_coal_blend")}
          >
            <Boxes className="size-4 shrink-0" />
            <span>TD21 và tính toán than</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("startup_shutdown")}
            className={reportTabClass(activeTab === "startup_shutdown")}
          >
            <Flame className="size-4 shrink-0" />
            <span>Khởi động/ngừng tổ máy</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("pmis_reports")}
            className={reportTabClass(activeTab === "pmis_reports")}
          >
            <FileText className="size-4 shrink-0" />
            <span>Báo cáo từ PMIS</span>
          </button>

          <div className="min-w-0">
            <button
              type="button"
              onClick={() => setActiveTab("all_fields")}
              className={`${reportTabClass(activeTab === "all_fields")} w-full`}
            >
              <Search className="size-4 shrink-0" />
              <span>Tra cứu ô ({editableFields.length})</span>
            </button>
          </div>
        </div>

        {/* NỘI DUNG TỪNG CỤM */}
        <div className="p-3">
          {/* ========================================================================= */}
          {/* TAB 1: CỤM 2 — BẢNG TKĐ TREND DCS (TRƯỞNG KÍP ĐIỆN NHẬP)                   */}
          {/* ========================================================================= */}
          {activeTab === "tkd_dcs" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                <div>
                  <h3 className="text-sm font-black text-[#173b64]">
                    Cụm 2: Bảng TKĐ trend DCS nhập (6 mốc giờ: 06h, 10h, 14h, 18h, 22h, 24h)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Trưởng kíp điện nhập 6 hàng: P TD 911, P TD 912, P TD 921, P TD 922, P TD 21,
                    Q TD 21. Các hàng công suất tổ máy lấy tự động từ BCSX mục 1. Các hàng tổng
                    tự động tính.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-md bg-blue-100 px-2 py-0.5 font-bold text-blue-800">
                    BCSX: Tự điền
                  </span>
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 font-bold text-amber-900">
                    TKĐ: Nhập tay
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-[#e9f2fa] text-[#173b64]">
                      <th className="p-2 text-left font-bold w-48">Thông số / Đại lượng</th>
                      <th className="p-2 text-center font-bold w-16">Đơn vị</th>
                      {TKD_HOURS.map(h => (
                        <th key={h.col} className="p-2 text-center font-bold">
                          {h.label}
                        </th>
                      ))}
                      <th className="p-2 text-center font-bold w-24">Cương vị nhập</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {/* Hàng 1: P S1 (MW) */}
                    <tr className="bg-blue-50/30">
                      <td className="p-2 font-semibold text-slate-800 font-sans">P S1 (MW)</td>
                      <td className="p-2 text-center text-slate-500">MW</td>
                      {TKD_HOURS.map(h => (
                        <td key={h.col} className="p-1.5 text-center">
                          {renderCellInput(`${h.col}3`, { isNumber: true })}
                        </td>
                      ))}
                      <td className="p-2 text-center text-[10px] text-blue-700 font-bold font-sans">
                        BCSX mục 1
                      </td>
                    </tr>

                    {/* Hàng 2: Q S1 (MVAr) */}
                    <tr className="bg-blue-50/30">
                      <td className="p-2 font-semibold text-slate-800 font-sans">Q S1 (MVAr)</td>
                      <td className="p-2 text-center text-slate-500">MVAr</td>
                      {TKD_HOURS.map(h => (
                        <td key={h.col} className="p-1.5 text-center">
                          {renderCellInput(`${h.col}4`, { isNumber: true })}
                        </td>
                      ))}
                      <td className="p-2 text-center text-[10px] text-blue-700 font-bold font-sans">
                        BCSX mục 1
                      </td>
                    </tr>

                    {/* Hàng 3: P S2 (MW) */}
                    <tr className="bg-blue-50/30">
                      <td className="p-2 font-semibold text-slate-800 font-sans">P S2 (MW)</td>
                      <td className="p-2 text-center text-slate-500">MW</td>
                      {TKD_HOURS.map(h => (
                        <td key={h.col} className="p-1.5 text-center">
                          {renderCellInput(`${h.col}5`, { isNumber: true })}
                        </td>
                      ))}
                      <td className="p-2 text-center text-[10px] text-blue-700 font-bold font-sans">
                        BCSX mục 1
                      </td>
                    </tr>

                    {/* Hàng 4: Q S2 (MVAr) */}
                    <tr className="bg-blue-50/30">
                      <td className="p-2 font-semibold text-slate-800 font-sans">Q S2 (MVAr)</td>
                      <td className="p-2 text-center text-slate-500">MVAr</td>
                      {TKD_HOURS.map(h => (
                        <td key={h.col} className="p-1.5 text-center">
                          {renderCellInput(`${h.col}6`, { isNumber: true })}
                        </td>
                      ))}
                      <td className="p-2 text-center text-[10px] text-blue-700 font-bold font-sans">
                        BCSX mục 1
                      </td>
                    </tr>

                    {/* Hàng 5: P MBT T1 (MW) */}
                    <tr className="bg-blue-50/30">
                      <td className="p-2 font-semibold text-slate-800 font-sans">P MBT T1 (MW)</td>
                      <td className="p-2 text-center text-slate-500">MW</td>
                      {TKD_HOURS.map(h => (
                        <td key={h.col} className="p-1.5 text-center">
                          {renderCellInput(`${h.col}7`, { isNumber: true })}
                        </td>
                      ))}
                      <td className="p-2 text-center text-[10px] text-blue-700 font-bold font-sans">
                        BCSX mục 1
                      </td>
                    </tr>

                    {/* Hàng 6: P MBT T2 (MW) */}
                    <tr className="bg-blue-50/30">
                      <td className="p-2 font-semibold text-slate-800 font-sans">P MBT T2 (MW)</td>
                      <td className="p-2 text-center text-slate-500">MW</td>
                      {TKD_HOURS.map(h => (
                        <td key={h.col} className="p-1.5 text-center">
                          {renderCellInput(`${h.col}8`, { isNumber: true })}
                        </td>
                      ))}
                      <td className="p-2 text-center text-[10px] text-blue-700 font-bold font-sans">
                        BCSX mục 1
                      </td>
                    </tr>

                    {/* Hàng 7: P TD 911 (MW) — TRƯỞNG KÍP ĐIỆN NHẬP */}
                    <tr className="bg-amber-50/40">
                      <td className="p-2 font-bold text-amber-950 font-sans">P TD 911 (MW)</td>
                      <td className="p-2 text-center text-slate-500">MW</td>
                      {TKD_HOURS.map(h => (
                        <td key={h.col} className="p-1.5 text-center">
                          {renderCellInput(`${h.col}9`, {
                            group: "tkd_trend",
                            isNumber: true,
                          })}
                        </td>
                      ))}
                      <td className="p-2 text-center text-[10px] font-bold text-amber-900 font-sans">
                        Trưởng kíp điện
                      </td>
                    </tr>

                    {/* Hàng 8: P TD 912 (MW) — TRƯỞNG KÍP ĐIỆN NHẬP */}
                    <tr className="bg-amber-50/40">
                      <td className="p-2 font-bold text-amber-950 font-sans">P TD 912 (MW)</td>
                      <td className="p-2 text-center text-slate-500">MW</td>
                      {TKD_HOURS.map(h => (
                        <td key={h.col} className="p-1.5 text-center">
                          {renderCellInput(`${h.col}10`, {
                            group: "tkd_trend",
                            isNumber: true,
                          })}
                        </td>
                      ))}
                      <td className="p-2 text-center text-[10px] font-bold text-amber-900 font-sans">
                        Trưởng kíp điện
                      </td>
                    </tr>

                    {/* Hàng 9: P Σ TD S1 (MW) — TỰ ĐỘNG TÍNH */}
                    <tr className="bg-slate-100/70 font-bold">
                      <td className="p-2 text-slate-900 font-sans">P Σ TD S1 (MW)</td>
                      <td className="p-2 text-center text-slate-500">MW</td>
                      {TKD_HOURS.map(h => (
                        <td key={h.col} className="p-2 text-right text-indigo-900 tabular-nums">
                          {format(tkdCalc[h.col]?.pSumTdS1)}
                        </td>
                      ))}
                      <td className="p-2 text-center text-[10px] text-slate-500 font-sans">
                        Tự động (911+912)
                      </td>
                    </tr>

                    {/* Hàng 10: P TD 921 (MW) — TRƯỞNG KÍP ĐIỆN NHẬP */}
                    <tr className="bg-amber-50/40">
                      <td className="p-2 font-bold text-amber-950 font-sans">P TD 921 (MW)</td>
                      <td className="p-2 text-center text-slate-500">MW</td>
                      {TKD_HOURS.map(h => (
                        <td key={h.col} className="p-1.5 text-center">
                          {renderCellInput(`${h.col}12`, {
                            group: "tkd_trend",
                            isNumber: true,
                          })}
                        </td>
                      ))}
                      <td className="p-2 text-center text-[10px] font-bold text-amber-900 font-sans">
                        Trưởng kíp điện
                      </td>
                    </tr>

                    {/* Hàng 11: P TD 922 (MW) — TRƯỞNG KÍP ĐIỆN NHẬP */}
                    <tr className="bg-amber-50/40">
                      <td className="p-2 font-bold text-amber-950 font-sans">P TD 922 (MW)</td>
                      <td className="p-2 text-center text-slate-500">MW</td>
                      {TKD_HOURS.map(h => (
                        <td key={h.col} className="p-1.5 text-center">
                          {renderCellInput(`${h.col}13`, {
                            group: "tkd_trend",
                            isNumber: true,
                          })}
                        </td>
                      ))}
                      <td className="p-2 text-center text-[10px] font-bold text-amber-900 font-sans">
                        Trưởng kíp điện
                      </td>
                    </tr>

                    {/* Hàng 12: P Σ TD S2 (MW) — TỰ ĐỘNG TÍNH */}
                    <tr className="bg-slate-100/70 font-bold">
                      <td className="p-2 text-slate-900 font-sans">P Σ TD S2 (MW)</td>
                      <td className="p-2 text-center text-slate-500">MW</td>
                      {TKD_HOURS.map(h => (
                        <td key={h.col} className="p-2 text-right text-indigo-900 tabular-nums">
                          {format(tkdCalc[h.col]?.pSumTdS2)}
                        </td>
                      ))}
                      <td className="p-2 text-center text-[10px] text-slate-500 font-sans">
                        Tự động (921+922)
                      </td>
                    </tr>

                    {/* Hàng 13: P TD 21 (MW) — TRƯỞNG KÍP ĐIỆN NHẬP */}
                    <tr className="bg-amber-50/40">
                      <td className="p-2 font-bold text-amber-950 font-sans">P TD 21 (MW)</td>
                      <td className="p-2 text-center text-slate-500">MW</td>
                      {TKD_HOURS.map(h => (
                        <td key={h.col} className="p-1.5 text-center">
                          {renderCellInput(`${h.col}15`, {
                            group: "tkd_trend",
                            isNumber: true,
                          })}
                        </td>
                      ))}
                      <td className="p-2 text-center text-[10px] font-bold text-amber-900 font-sans">
                        Trưởng kíp điện
                      </td>
                    </tr>

                    {/* Hàng 14: Q TD 21 (MVAr) — TRƯỞNG KÍP ĐIỆN NHẬP */}
                    <tr className="bg-amber-50/40">
                      <td className="p-2 font-bold text-amber-950 font-sans">Q TD 21( MVAr)</td>
                      <td className="p-2 text-center text-slate-500">MVAr</td>
                      {TKD_HOURS.map(h => (
                        <td key={h.col} className="p-1.5 text-center">
                          {renderCellInput(`${h.col}16`, {
                            group: "tkd_trend",
                            isNumber: true,
                          })}
                        </td>
                      ))}
                      <td className="p-2 text-center text-[10px] font-bold text-amber-900 font-sans">
                        Trưởng kíp điện
                      </td>
                    </tr>

                    {/* Hàng 15: P Σ S1+S2 (MW) — TỰ ĐỘNG TÍNH */}
                    <tr className="bg-indigo-50/50 font-bold">
                      <td className="p-2 text-indigo-950 font-sans">P Σ S1+S2 (MW)</td>
                      <td className="p-2 text-center text-slate-500">MW</td>
                      {TKD_HOURS.map(h => (
                        <td key={h.col} className="p-2 text-right text-indigo-900 tabular-nums">
                          {format(tkdCalc[h.col]?.pSumS1S2)}
                        </td>
                      ))}
                      <td className="p-2 text-center text-[10px] text-slate-500 font-sans">
                        Tự động (S1+S2)
                      </td>
                    </tr>

                    {/* Hàng 16: P Σ T1+T2 (MW) — TỰ ĐỘNG TÍNH */}
                    <tr className="bg-indigo-50/50 font-bold">
                      <td className="p-2 text-indigo-950 font-sans">P Σ T1+T2 (MW)</td>
                      <td className="p-2 text-center text-slate-500">MW</td>
                      {TKD_HOURS.map(h => (
                        <td key={h.col} className="p-2 text-right text-indigo-900 tabular-nums">
                          {format(tkdCalc[h.col]?.pSumT1T2)}
                        </td>
                      ))}
                      <td className="p-2 text-center text-[10px] text-slate-500 font-sans">
                        Tự động (T1+T2)
                      </td>
                    </tr>

                    {/* Hàng 17: Q Σ S1+S2 (MVar) — TỰ ĐỘNG TÍNH */}
                    <tr className="bg-indigo-50/50 font-bold">
                      <td className="p-2 text-indigo-950 font-sans">Q Σ S1+S2 (MVar)</td>
                      <td className="p-2 text-center text-slate-500">MVAr</td>
                      {TKD_HOURS.map(h => (
                        <td key={h.col} className="p-2 text-right text-indigo-900 tabular-nums">
                          {format(tkdCalc[h.col]?.qSumS1S2)}
                        </td>
                      ))}
                      <td className="p-2 text-center text-[10px] text-slate-500 font-sans">
                        Tự động (Q1+Q2)
                      </td>
                    </tr>

                    {/* Hàng 18: Utc 220kV */}
                    <tr className="bg-blue-50/30">
                      <td className="p-2 font-semibold text-slate-800 font-sans">Utc 220kV</td>
                      <td className="p-2 text-center text-slate-500">kV</td>
                      {TKD_HOURS.map(h => (
                        <td key={h.col} className="p-1.5 text-center">
                          {renderCellInput(`${h.col}20`, { isNumber: true })}
                        </td>
                      ))}
                      <td className="p-2 text-center text-[10px] text-blue-700 font-bold font-sans">
                        BCSX mục 1
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* BẢNG CÔNG TƠ NƯỚC DEMIN TẠI DCS (MỐC 24H) — HÀNG 72–74 */}
              <div className="mt-6 space-y-3 pt-4 border-t-2 border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black text-[#0f5132] flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#00b050]" />
                      Bảng công tơ nước demin tại DCS (Mốc 24h) — Hàng 72 đến 74
                    </h3>
                    <p className="text-xs text-slate-500">
                      Trưởng kíp điện nhập chỉ số công tơ 24h ngày D, lượng nước tái sinh hạt và số hiệu chỉnh (khi công tơ chạm dãy max 25.000 m³ reset về 0). Cột 24h ngày D-1 tự động kế thừa từ ngày trước. Lượng tiêu thụ ngày D tự động tính (X − W + Hiệu chỉnh).
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800">
                      Mốc 24h DCS
                    </span>
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 font-bold text-amber-900">
                      TKĐ: Nhập tay
                    </span>
                    <span className="rounded-md bg-sky-100 px-2 py-0.5 font-bold text-sky-900">
                      Tự động tính
                    </span>
                  </div>
                </div>

                {(() => {
                  const numX72 = parseDeminNum(current["X72"]);
                  const numW72 = parseDeminNum(current["W72"] || previous?.["X72"]);
                  const isRolloverS1 = numX72 !== null && numW72 !== null && numX72 < numW72;

                  const numX73 = parseDeminNum(current["X73"]);
                  const numW73 = parseDeminNum(current["W73"] || previous?.["X73"]);
                  const isRolloverS2 = numX73 !== null && numW73 !== null && numX73 < numW73;

                  return (
                    <div className="overflow-x-auto rounded-xl border border-emerald-300 bg-white shadow-xs">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-[#d1e7dd] text-[#0f5132]">
                            <th className="p-2.5 text-left font-bold min-w-[240px]">Thông số công tơ nước</th>
                            <th className="p-2.5 text-center font-bold w-32">
                              24h ngày D-1
                              <div className="text-[10px] font-normal text-emerald-700">(Cột W)</div>
                            </th>
                            <th className="p-2.5 text-center font-bold w-32">
                              24h ngày D
                              <div className="text-[10px] font-normal text-emerald-700">(Cột X)</div>
                            </th>
                            <th className="p-2.5 text-center font-bold w-36 bg-amber-100/70 text-amber-950">
                              Hiệu chỉnh (m³)
                              <div className="text-[10px] font-normal text-amber-800">(Mặc định 0 · Bù dãy 25.000)</div>
                            </th>
                            <th className="p-2.5 text-center font-bold w-36 bg-[#c3e6cb] text-[#0a3622]">
                              Lượng nước SD ngày D (m³)
                              <div className="text-[10px] font-normal text-emerald-800">(Cột Y = X − W + HC)</div>
                            </th>
                            <th className="p-2.5 text-center font-bold w-32">
                              Nước tái sinh hạt (m³)
                              <div className="text-[10px] font-normal text-emerald-700">(Cột Z)</div>
                            </th>
                            <th className="p-2.5 text-center font-bold min-w-[220px]">Lý do hiệu chỉnh / Ghi chú</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {/* Hàng 72: Tổ máy 1 */}
                          <tr className="hover:bg-emerald-50/30">
                            <td className="p-2.5 font-semibold text-slate-800 font-sans">
                              Công tơ nước demin tại DCS tổ máy 1
                              <span className="ml-1 text-[10px] text-slate-400 font-mono">(Hàng 72)</span>
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("W72", {
                                placeholder: previous?.["X72"] || "—",
                                group: "tkd_trend",
                                isNumber: true,
                              })}
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("X72", {
                                placeholder: "Nhập 24h",
                                group: "tkd_trend",
                                isNumber: true,
                              })}
                            </td>
                            <td className="p-1.5 text-center bg-amber-50/30">
                              {renderCellInput("WATER_ADJ_S1", {
                                placeholder: "0",
                                group: "tkd_trend",
                                isNumber: true,
                              })}
                              {isRolloverS1 && (!current["WATER_ADJ_S1"] || current["WATER_ADJ_S1"] === "0") && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    update("WATER_ADJ_S1", "25000");
                                    if (!current["WATER_ADJ_NOTE_S1"]) update("WATER_ADJ_NOTE_S1", "Reset về 0 qua mốc 25.000");
                                  }}
                                  className="mt-1 inline-flex items-center gap-1 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 hover:bg-amber-300 border border-amber-400 shadow-2xs"
                                  title="Phát hiện X < W: Nhấn để bù tự động +25.000 m³ do đảo công tơ"
                                >
                                  ⚡ +25.000 (Reset)
                                </button>
                              )}
                            </td>
                            <td className="p-2 text-right font-black font-mono text-emerald-900 bg-emerald-50/60 tabular-nums">
                              {formatDeminDiff(current["X72"], current["W72"] || previous?.["X72"], current["WATER_ADJ_S1"])}
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("Z72", {
                                placeholder: linkedByDate[date]?.["Z72"] || "0",
                                group: "tkd_trend",
                                isNumber: true,
                              })}
                            </td>
                            <td className="p-1.5">
                              <div className="space-y-1">
                                {renderCellInput("WATER_ADJ_NOTE_S1", {
                                  placeholder: "Lý do hiệu chỉnh (nếu có)...",
                                  group: "tkd_trend",
                                  isNumber: false,
                                  maxLength: 500,
                                  className: "!text-left !font-sans !text-[11px]",
                                })}
                                {linkedByDate[date]?.["Z72"] !== undefined && (
                                  <div className="text-[10px] text-sky-700 font-bold flex items-center gap-1 pl-1" title="Tự động liên kết từ Báo cáo Theo dõi lượng nước">
                                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                                    Link Lượng nước ({linkedByDate[date]["Z72"]} m³)
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Hàng 73: Tổ máy 2 */}
                          <tr className="hover:bg-emerald-50/30">
                            <td className="p-2.5 font-semibold text-slate-800 font-sans">
                              Công tơ nước demin tại DCS tổ máy 2
                              <span className="ml-1 text-[10px] text-slate-400 font-mono">(Hàng 73)</span>
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("W73", {
                                placeholder: previous?.["X73"] || "—",
                                group: "tkd_trend",
                                isNumber: true,
                              })}
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("X73", {
                                placeholder: "Nhập 24h",
                                group: "tkd_trend",
                                isNumber: true,
                              })}
                            </td>
                            <td className="p-1.5 text-center bg-amber-50/30">
                              {renderCellInput("WATER_ADJ_S2", {
                                placeholder: "0",
                                group: "tkd_trend",
                                isNumber: true,
                              })}
                              {isRolloverS2 && (!current["WATER_ADJ_S2"] || current["WATER_ADJ_S2"] === "0") && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    update("WATER_ADJ_S2", "25000");
                                    if (!current["WATER_ADJ_NOTE_S2"]) update("WATER_ADJ_NOTE_S2", "Reset về 0 qua mốc 25.000");
                                  }}
                                  className="mt-1 inline-flex items-center gap-1 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 hover:bg-amber-300 border border-amber-400 shadow-2xs"
                                  title="Phát hiện X < W: Nhấn để bù tự động +25.000 m³ do đảo công tơ"
                                >
                                  ⚡ +25.000 (Reset)
                                </button>
                              )}
                            </td>
                            <td className="p-2 text-right font-black font-mono text-emerald-900 bg-emerald-50/60 tabular-nums">
                              {formatDeminDiff(current["X73"], current["W73"] || previous?.["X73"], current["WATER_ADJ_S2"])}
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("Z73", {
                                placeholder: linkedByDate[date]?.["Z73"] || "0",
                                group: "tkd_trend",
                                isNumber: true,
                              })}
                            </td>
                            <td className="p-1.5">
                              <div className="space-y-1">
                                {renderCellInput("WATER_ADJ_NOTE_S2", {
                                  placeholder: "Lý do hiệu chỉnh (nếu có)...",
                                  group: "tkd_trend",
                                  isNumber: false,
                                  maxLength: 500,
                                  className: "!text-left !font-sans !text-[11px]",
                                })}
                                {linkedByDate[date]?.["Z73"] !== undefined && (
                                  <div className="text-[10px] text-sky-700 font-bold flex items-center gap-1 pl-1" title="Tự động liên kết từ Báo cáo Theo dõi lượng nước">
                                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                                    Link Lượng nước ({linkedByDate[date]["Z73"]} m³)
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Hàng 74: Tổng cả ngày của 2 tổ máy */}
                          <tr className="bg-[#e8f5e9] font-bold border-t-2 border-emerald-300">
                            <td className="p-2.5 text-emerald-950 font-sans font-bold">
                              Tổng lượng nước demin sử dụng của cả ngày D của 2 tổ máy
                              <span className="ml-1 text-[10px] text-emerald-700 font-mono">(Hàng 74)</span>
                            </td>
                            <td className="p-2 text-center text-slate-400 font-sans">—</td>
                            <td className="p-2 text-center text-slate-400 font-sans">—</td>
                            <td className="p-2 text-right font-black font-mono text-amber-950 bg-amber-100/70 tabular-nums">
                              {formatAdjTotal(current["WATER_ADJ_S1"], current["WATER_ADJ_S2"])}
                            </td>
                            <td className="p-2 text-right font-black font-mono text-emerald-950 bg-emerald-100/80 tabular-nums text-sm">
                              {formatDeminTotal(
                                current["X72"],
                                current["W72"] || previous?.["X72"],
                                current["WATER_ADJ_S1"],
                                current["X73"],
                                current["W73"] || previous?.["X73"],
                                current["WATER_ADJ_S2"],
                              )}
                            </td>
                            <td className="p-2 text-right font-black font-mono text-emerald-950 bg-emerald-100/80 tabular-nums text-sm">
                              {formatResinTotal(current["Z72"], current["Z73"])}
                            </td>
                            <td className="p-2 text-center text-[11px] text-emerald-800 font-sans">
                              Tự động (Y72+Y73, Z72+Z73)
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: CỤM 4 & 5 — CÔNG TƠ TỔ MÁY S1 & S2 (TPD, LÒ PHÓ, MÁY NGHIỀN)        */}
          {/* ========================================================================= */}
          {activeTab === "unit_meters" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-2">
                <div>
                  <h3 className="text-sm font-black text-[#173b64]">
                    Cụm 4 & 5: Bảng ghi công tơ Tổ máy S1 & Tổ máy S2
                  </h3>
                  <p className="text-xs text-slate-500">
                    Phân tách thành 3 nhóm quyền riêng biệt: Trực phụ điện (Điện) · Lò phó (Dầu F1 -
                    F2) · Vận hành viên Máy nghiền (12 cân than A1..F2).
                  </p>
                </div>
                {/* Bộ chuyển tổ máy */}
                <div className="flex items-center rounded-xl bg-slate-100 p-0.5 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setUnitView("s1")}
                    className={`rounded-lg px-3 py-1.5 transition-all ${
                      unitView === "s1"
                        ? "bg-white text-indigo-700 shadow-xs"
                        : "text-slate-600 hover:text-black"
                    }`}
                  >
                    Tổ máy S1
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnitView("s2")}
                    className={`rounded-lg px-3 py-1.5 transition-all ${
                      unitView === "s2"
                        ? "bg-white text-indigo-700 shadow-xs"
                        : "text-slate-600 hover:text-black"
                    }`}
                  >
                    Tổ máy S2
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnitView("both")}
                    className={`rounded-lg px-3 py-1.5 transition-all ${
                      unitView === "both"
                        ? "bg-white text-indigo-700 shadow-xs"
                        : "text-slate-600 hover:text-black"
                    }`}
                  >
                    Xem cả hai
                  </button>
                </div>
              </div>

              {(unitView === "s1" || unitView === "both") && (
                <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-xs">
                  <div className="flex items-center justify-between border-b pb-2 mb-3">
                    <h4 className="text-sm font-black text-[#173b64]">
                      TỔ MÁY S1 — BẢNG CÔNG TƠ & CHỈ TIÊU VẬN HÀNH
                    </h4>
                    <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                      Tổ máy 1
                    </span>
                  </div>

                  {/* 1. KHỐI ĐIỆN — TRỰC PHỤ ĐIỆN / TRỰC CHÍNH ĐIỆN NHẬP */}
                  <div className="mb-4">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">
                        1. Khối Điện: Công tơ MF, MBT T1, Tự dùng TD911, TD912
                      </span>
                      <span className="text-[11px] font-bold text-indigo-700">
                        Cương vị nhập: Trực phụ điện / Trực chính Điện
                      </span>
                    </div>
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[#f0f4f9] text-[#173b64]">
                            <th className="p-1.5 text-left font-bold">Tên công tơ S1</th>
                            <th className="p-1.5 text-center font-bold w-16">Đơn vị</th>
                            <th className="p-1.5 text-center font-bold">06h</th>
                            <th className="p-1.5 text-center font-bold">14h</th>
                            <th className="p-1.5 text-center font-bold">22h</th>
                            <th className="p-1.5 text-center font-bold">24h</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          <tr>
                            <td className="p-2 font-semibold text-slate-800 font-sans">
                              Công tơ máy phát (MWh)
                            </td>
                            <td className="p-2 text-center text-slate-500">MWh</td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("W8", { group: "tpd_tcd_power" })}
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("Y8", { group: "tpd_tcd_power" })}
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("AA8", { group: "tpd_tcd_power" })}
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("AB8", { group: "tpd_tcd_power" })}
                            </td>
                          </tr>
                          <tr>
                            <td className="p-2 font-semibold text-slate-800 font-sans">
                              Công tơ điện MBT T1 (MWh)
                            </td>
                            <td className="p-2 text-center text-slate-500">MWh</td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("W9", { group: "tpd_tcd_power" })}
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("Y9", { group: "tpd_tcd_power" })}
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("AA9", { group: "tpd_tcd_power" })}
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("AB9", { group: "tpd_tcd_power" })}
                            </td>
                          </tr>
                          <tr>
                            <td className="p-2 font-semibold text-slate-800 font-sans">
                              Công tơ điện tự dùng TD 911 (MWh)
                            </td>
                            <td className="p-2 text-center text-slate-500">MWh</td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("W10", { group: "tpd_tcd_power" })}
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("Y10", { group: "tpd_tcd_power" })}
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("AA10", { group: "tpd_tcd_power" })}
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("AB10", { group: "tpd_tcd_power" })}
                            </td>
                          </tr>
                          <tr>
                            <td className="p-2 font-semibold text-slate-800 font-sans">
                              Công tơ điện tự dùng TD 912 (MWh)
                            </td>
                            <td className="p-2 text-center text-slate-500">MWh</td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("W11", { group: "tpd_tcd_power" })}
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("Y11", { group: "tpd_tcd_power" })}
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("AA11", { group: "tpd_tcd_power" })}
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("AB11", { group: "tpd_tcd_power" })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 2. KHỐI DẦU — LÒ PHÓ NHẬP */}
                  <div className="mb-4">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">
                        2. Khối Dầu: Công tơ dầu cấp lò F1 & dầu về bồn F2 (tấn)
                      </span>
                      <span className="text-[11px] font-bold text-amber-800">
                        Cương vị nhập: Lò phó
                      </span>
                    </div>
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[#fcf8f2] text-amber-950">
                            <th className="p-1.5 text-left font-bold">Chỉ số dầu S1 (tấn)</th>
                            {OIL_HOURS.map(h => (
                              <th key={h.label} className="p-1.5 text-center font-bold">
                                {h.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          <tr>
                            <td className="p-2 font-semibold text-slate-800 font-sans">
                              Công tơ dầu cấp lò F1 (t)
                            </td>
                            {OIL_HOURS.map(h => (
                              <td key={h.label} className="p-1.5 text-center">
                                {renderCellInput(`${h.colS1}13`, { group: "lo_pho_oil" })}
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="p-2 font-semibold text-slate-800 font-sans">
                              Công tơ dầu về bồn F2 (t)
                            </td>
                            {OIL_HOURS.map(h => (
                              <td key={h.label} className="p-1.5 text-center">
                                {renderCellInput(`${h.colS1}14`, { group: "lo_pho_oil" })}
                              </td>
                            ))}
                          </tr>
                          <tr className="bg-amber-50/50 font-bold">
                            <td className="p-2 text-amber-900 font-sans">
                              Dầu tiêu thụ từng kỳ = ΔF1 - ΔF2 (t), kỳ 06h lấy mốc D-1
                            </td>
                            {oilS1.map(o => (
                              <td key={o.label} className="p-2 text-right text-amber-900">
                                {format(o.diff)}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 3. KHỐI THAN — VẬN HÀNH VIÊN MÁY NGHIỀN S1 NHẬP */}
                  <div className="mb-4">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">
                        3. Khối Than: 12 công tơ than Máy nghiền S1 (A1..F2)
                      </span>
                      <span className="text-[11px] font-bold text-slate-800">
                        Cương vị nhập: Vận hành viên Máy nghiền S1
                      </span>
                    </div>
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[#f5f5f5] text-slate-800">
                            <th className="p-1.5 text-left font-bold">Mã cân than S1</th>
                            <th className="p-1.5 text-center font-bold">08h (Ca 1)</th>
                            <th className="p-1.5 text-center font-bold">16h (Ca 2)</th>
                            <th className="p-1.5 text-center font-bold">24h (Ca 3)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {[
                            { code: "A1", row: 16 },
                            { code: "A2", row: 17 },
                            { code: "B1", row: 18 },
                            { code: "B2", row: 19 },
                            { code: "C1", row: 20 },
                            { code: "C2", row: 21 },
                            { code: "D1", row: 22 },
                            { code: "D2", row: 23 },
                            { code: "E1", row: 24 },
                            { code: "E2", row: 25 },
                            { code: "F1", row: 26 },
                            { code: "F2", row: 27 },
                          ].map(c => (
                            <tr key={c.code} className="hover:bg-slate-50">
                              <td className="p-1.5 font-bold text-slate-800 font-sans">
                                Công tơ than # {c.code}
                              </td>
                              <td className="p-1 text-center">
                                {renderCellInput(`X${c.row}`, {
                                  group: "may_nghien_coal_s1",
                                })}
                              </td>
                              <td className="p-1 text-center">
                                {renderCellInput(`Z${c.row}`, {
                                  group: "may_nghien_coal_s1",
                                })}
                              </td>
                              <td className="p-1 text-center">
                                {renderCellInput(`AB${c.row}`, {
                                  group: "may_nghien_coal_s1",
                                })}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-amber-50/50">
                            <td className="p-2 font-bold text-amber-950 font-sans">
                              Hiệu chỉnh chênh lệch cân than (tấn, mặc định 0)
                            </td>
                            {(["W28", "Y28", "AA28"] as const).map(cell => (
                              <td key={cell} className="p-1 text-center">
                                {renderCellInput(cell, { group: "may_nghien_coal_s1" })}
                              </td>
                            ))}
                          </tr>
                          <tr className="bg-amber-50/30">
                            <td className="p-2 font-bold text-amber-950 font-sans">
                              Lý do hiệu chỉnh (máy cấp / giá trị)
                            </td>
                            <td colSpan={3} className="p-1">
                              {renderCellInput("COAL_ADJ_NOTE_S1", {
                                group: "may_nghien_coal_s1",
                                isNumber: false,
                                placeholder: "Ví dụ: Máy cấp 1B1, cộng 12,5 tấn do cân lệch",
                                maxLength: 500,
                                className: "!text-left !font-sans !font-medium",
                              })}
                            </td>
                          </tr>
                          <tr className="bg-slate-100 font-black">
                            <td className="p-2 text-slate-900 font-sans">
                              Lượng than tiêu thụ - tấn (S1)
                            </td>
                            <td colSpan={3} className="p-2 text-right text-indigo-900 font-mono">
                              Tổng ngày: {format(summary.s1.rawCoalTonnes)} tấn
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 4. CHỈ SỐ THỐNG KÊ TỔ MÁY S1 */}
                  <div className="rounded-lg bg-slate-50 p-3 text-xs border border-slate-200">
                    <span className="font-bold text-[#173b64] block mb-2">
                      Chỉ số thống kê tự động - Tổ máy S1:
                    </span>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 font-mono">
                      <div className="rounded bg-white p-2 border">
                        <span className="text-[11px] text-slate-500 font-sans block">
                          Sản lượng điện MF:
                        </span>
                        <b className="text-indigo-900">{format(summary.s1.grossMwh)} MWh</b>
                      </div>
                      <div className="rounded bg-white p-2 border">
                        <span className="text-[11px] text-slate-500 font-sans block">
                          Điện giao MBT T1:
                        </span>
                        <b className="text-indigo-900">{format(summary.s1.netMwh)} MWh</b>
                      </div>
                      <div className="rounded bg-white p-2 border">
                        <span className="text-[11px] text-slate-500 font-sans block">
                          Tổng tự dùng S1:
                        </span>
                        <b className="text-indigo-900">{format(summary.s1.auxiliaryMwh)} MWh</b>
                      </div>
                      <div className="rounded bg-white p-2 border">
                        <span className="text-[11px] text-slate-500 font-sans block">
                          Tỷ lệ tự dùng:
                        </span>
                        <b className="text-indigo-900">
                          {format(summary.s1.auxiliaryPercent)} %
                        </b>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(unitView === "s2" || unitView === "both") && (
                <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-xs">
                  <div className="flex items-center justify-between border-b pb-2 mb-3">
                    <h4 className="text-sm font-black text-[#173b64]">
                      TỔ MÁY S2 — BẢNG CÔNG TƠ & CHỈ TIÊU VẬN HÀNH
                    </h4>
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      Tổ máy 2
                    </span>
                  </div>

                  {/* 1. KHỐI ĐIỆN S2 */}
                  <div className="mb-4">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">
                        1. Khối Điện: Công tơ MF, MBT T2, Tự dùng TD921, TD922
                      </span>
                      <span className="text-[11px] font-bold text-indigo-700">
                        Cương vị nhập: Trực phụ điện / Trực chính Điện
                      </span>
                    </div>
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[#f0f4f9] text-[#173b64]">
                            <th className="p-1.5 text-left font-bold">Tên công tơ S2</th>
                            <th className="p-1.5 text-center font-bold w-16">Đơn vị</th>
                            <th className="p-1.5 text-center font-bold">06h</th>
                            <th className="p-1.5 text-center font-bold">14h</th>
                            <th className="p-1.5 text-center font-bold">22h</th>
                            <th className="p-1.5 text-center font-bold">24h</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          <tr>
                            <td className="p-2 font-semibold text-slate-800 font-sans">
                              Công tơ máy phát (MWh)
                            </td>
                            <td className="p-2 text-center text-slate-500">MWh</td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("AG8", { group: "tpd_tcd_power" })}
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("AI8", { group: "tpd_tcd_power" })}
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("AK8", { group: "tpd_tcd_power" })}
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("AL8", { group: "tpd_tcd_power" })}
                            </td>
                          </tr>
                          <tr>
                            <td className="p-2 font-semibold text-slate-800 font-sans">
                              Công tơ điện MBT T2 (MWh)
                            </td>
                            <td className="p-2 text-center text-slate-500">MWh</td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("AG9", { group: "tpd_tcd_power" })}
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("AI9", { group: "tpd_tcd_power" })}
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("AK9", { group: "tpd_tcd_power" })}
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("AL9", { group: "tpd_tcd_power" })}
                            </td>
                          </tr>
                          <tr>
                            <td className="p-2 font-semibold text-slate-800 font-sans">
                              Công tơ điện tự dùng TD 921 (MWh)
                            </td>
                            <td className="p-2 text-center text-slate-500">MWh</td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("AG10", { group: "tpd_tcd_power" })}
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("AI10", { group: "tpd_tcd_power" })}
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("AK10", { group: "tpd_tcd_power" })}
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("AL10", { group: "tpd_tcd_power" })}
                            </td>
                          </tr>
                          <tr>
                            <td className="p-2 font-semibold text-slate-800 font-sans">
                              Công tơ điện tự dùng TD 922 (MWh)
                            </td>
                            <td className="p-2 text-center text-slate-500">MWh</td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("AG11", { group: "tpd_tcd_power" })}
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("AI11", { group: "tpd_tcd_power" })}
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("AK11", { group: "tpd_tcd_power" })}
                            </td>
                            <td className="p-1.5 text-center">
                              {renderCellInput("AL11", { group: "tpd_tcd_power" })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 2. KHỐI DẦU S2 (Đơn vị: kg) */}
                  <div className="mb-4">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">
                        2. Khối Dầu: Công tơ dầu cấp lò F1 & dầu về bồn F2 (kg)
                      </span>
                      <span className="text-[11px] font-bold text-amber-800">
                        Cương vị nhập: Lò phó
                      </span>
                    </div>
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[#fcf8f2] text-amber-950">
                            <th className="p-1.5 text-left font-bold">Chỉ số dầu S2 (kg)</th>
                            {OIL_HOURS.map(h => (
                              <th key={h.label} className="p-1.5 text-center font-bold">
                                {h.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          <tr>
                            <td className="p-2 font-semibold text-slate-800 font-sans">
                              Công tơ dầu cấp lò F1 (kg)
                            </td>
                            {OIL_HOURS.map(h => (
                              <td key={h.label} className="p-1.5 text-center">
                                {renderCellInput(`${h.colS2}13`, { group: "lo_pho_oil" })}
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="p-2 font-semibold text-slate-800 font-sans">
                              Công tơ dầu về bồn F2 (kg)
                            </td>
                            {OIL_HOURS.map(h => (
                              <td key={h.label} className="p-1.5 text-center">
                                {renderCellInput(`${h.colS2}14`, { group: "lo_pho_oil" })}
                              </td>
                            ))}
                          </tr>
                          <tr className="bg-amber-50/50 font-bold">
                            <td className="p-2 text-amber-900 font-sans">
                              Dầu tiêu thụ từng kỳ = ΔF1 - ΔF2 (kg), kỳ 06h lấy mốc D-1
                            </td>
                            {oilS2.map(o => (
                              <td key={o.label} className="p-2 text-right text-amber-900">
                                {format(o.diff)}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 3. KHỐI THAN S2 */}
                  <div className="mb-4">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">
                        3. Khối Than: 12 công tơ than Máy nghiền S2 (A1..F2)
                      </span>
                      <span className="text-[11px] font-bold text-slate-800">
                        Cương vị nhập: Vận hành viên Máy nghiền S2
                      </span>
                    </div>
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[#f5f5f5] text-slate-800">
                            <th className="p-1.5 text-left font-bold">Mã cân than S2</th>
                            <th className="p-1.5 text-center font-bold">08h (Ca 1)</th>
                            <th className="p-1.5 text-center font-bold">16h (Ca 2)</th>
                            <th className="p-1.5 text-center font-bold">24h (Ca 3)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {[
                            { code: "A1", row: 16 },
                            { code: "A2", row: 17 },
                            { code: "B1", row: 18 },
                            { code: "B2", row: 19 },
                            { code: "C1", row: 20 },
                            { code: "C2", row: 21 },
                            { code: "D1", row: 22 },
                            { code: "D2", row: 23 },
                            { code: "E1", row: 24 },
                            { code: "E2", row: 25 },
                            { code: "F1", row: 26 },
                            { code: "F2", row: 27 },
                          ].map(c => (
                            <tr key={c.code} className="hover:bg-slate-50">
                              <td className="p-1.5 font-bold text-slate-800 font-sans">
                                Công tơ than # {c.code}
                              </td>
                              <td className="p-1 text-center">
                                {renderCellInput(`AH${c.row}`, {
                                  group: "may_nghien_coal_s2",
                                })}
                              </td>
                              <td className="p-1 text-center">
                                {renderCellInput(`AJ${c.row}`, {
                                  group: "may_nghien_coal_s2",
                                })}
                              </td>
                              <td className="p-1 text-center">
                                {renderCellInput(`AL${c.row}`, {
                                  group: "may_nghien_coal_s2",
                                })}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-amber-50/50">
                            <td className="p-2 font-bold text-amber-950 font-sans">
                              Hiệu chỉnh chênh lệch cân than (tấn, mặc định 0)
                            </td>
                            {(["AG28", "AI28", "AK28"] as const).map(cell => (
                              <td key={cell} className="p-1 text-center">
                                {renderCellInput(cell, { group: "may_nghien_coal_s2" })}
                              </td>
                            ))}
                          </tr>
                          <tr className="bg-amber-50/30">
                            <td className="p-2 font-bold text-amber-950 font-sans">
                              Lý do hiệu chỉnh (máy cấp / giá trị)
                            </td>
                            <td colSpan={3} className="p-1">
                              {renderCellInput("COAL_ADJ_NOTE_S2", {
                                group: "may_nghien_coal_s2",
                                isNumber: false,
                                placeholder: "Ví dụ: Máy cấp 2A2, trừ 8,0 tấn do kiểm tra cân",
                                maxLength: 500,
                                className: "!text-left !font-sans !font-medium",
                              })}
                            </td>
                          </tr>
                          <tr className="bg-slate-100 font-black">
                            <td className="p-2 text-slate-900 font-sans">
                              Lượng than tiêu thụ - tấn (S2)
                            </td>
                            <td colSpan={3} className="p-2 text-right text-indigo-900 font-mono">
                              Tổng ngày: {format(summary.s2.rawCoalTonnes)} tấn
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 4. CHỈ SỐ THỐNG KÊ S2 */}
                  <div className="rounded-lg bg-slate-50 p-3 text-xs border border-slate-200">
                    <span className="font-bold text-[#173b64] block mb-2">
                      Chỉ số thống kê tự động - Tổ máy S2:
                    </span>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 font-mono">
                      <div className="rounded bg-white p-2 border">
                        <span className="text-[11px] text-slate-500 font-sans block">
                          Sản lượng điện MF:
                        </span>
                        <b className="text-indigo-900">{format(summary.s2.grossMwh)} MWh</b>
                      </div>
                      <div className="rounded bg-white p-2 border">
                        <span className="text-[11px] text-slate-500 font-sans block">
                          Điện giao MBT T2:
                        </span>
                        <b className="text-indigo-900">{format(summary.s2.netMwh)} MWh</b>
                      </div>
                      <div className="rounded bg-white p-2 border">
                        <span className="text-[11px] text-slate-500 font-sans block">
                          Tổng tự dùng S2:
                        </span>
                        <b className="text-indigo-900">{format(summary.s2.auxiliaryMwh)} MWh</b>
                      </div>
                      <div className="rounded bg-white p-2 border">
                        <span className="text-[11px] text-slate-500 font-sans block">
                          Tỷ lệ tự dùng:
                        </span>
                        <b className="text-indigo-900">
                          {format(summary.s2.auxiliaryPercent)} %
                        </b>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: CỤM 6 & 8 — LƯU LƯỢNG HƠI & BỒN NH3                                 */}
          {/* ========================================================================= */}
          {activeTab === "steam_nh3" && (
            <div className="space-y-6">
              {/* CỤM 6: LƯU LƯỢNG HƠI */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 mb-3">
                  <div>
                    <h3 className="text-sm font-black text-[#173b64]">
                      Cụm 6: Bảng thống kê Lưu lượng hơi Tổ máy S1 & Tổ máy S2
                    </h3>
                    <p className="text-xs text-slate-500">
                      Trưởng kíp điện nhập Tổng lưu lượng hơi tại 6 mốc: 06h, 10h, 14h, 18h, 22h,
                      24h. Dòng sản lượng hơi tiêu thụ tự động tính theo chênh lệch các mốc.
                    </p>
                  </div>
                  <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-800">
                    Trưởng kíp điện
                  </span>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#f0f4f9] text-[#173b64]">
                        <th className="p-2 text-left font-bold w-64">Chỉ tiêu hơi</th>
                        {STEAM_HOURS.map(h => (
                          <th key={h.label} className="p-2 text-center font-bold">
                            {h.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {/* S1 Tổng lưu lượng hơi */}
                      <tr>
                        <td className="p-2 font-bold text-slate-800 font-sans">
                          Tổng lưu lượng hơi S1 (tấn)
                        </td>
                        {STEAM_HOURS.map(h => (
                          <td key={h.label} className="p-1.5 text-center">
                            {renderCellInput(`${h.colS1}54`, { group: "steam_flow" })}
                          </td>
                        ))}
                      </tr>
                      {/* S1 Sản lượng hơi tiêu thụ */}
                      <tr className="bg-slate-50 font-bold text-indigo-900">
                        <td className="p-2 font-sans">Sản lượng hơi S1 tiêu thụ (tấn)</td>
                        {steamS1.map(s => (
                          <td key={s.label} className="p-2 text-right tabular-nums">
                            {format(s.consumption)}
                          </td>
                        ))}
                      </tr>

                      {/* S2 Tổng lưu lượng hơi */}
                      <tr>
                        <td className="p-2 font-bold text-slate-800 font-sans">
                          Tổng lưu lượng hơi S2 (tấn)
                        </td>
                        {STEAM_HOURS.map(h => (
                          <td key={h.label} className="p-1.5 text-center">
                            {renderCellInput(`${h.colS2}54`, { group: "steam_flow" })}
                          </td>
                        ))}
                      </tr>
                      {/* S2 Sản lượng hơi tiêu thụ */}
                      <tr className="bg-slate-50 font-bold text-indigo-900">
                        <td className="p-2 font-sans">Sản lượng hơi S2 tiêu thụ (tấn)</td>
                        {steamS2.map(s => (
                          <td key={s.label} className="p-2 text-right tabular-nums">
                            {format(s.consumption)}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CỤM 8: TỔNG LƯỢNG NH3 */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 mb-3">
                  <div>
                    <h3 className="text-sm font-black text-[#173b64]">
                      Cụm 8: Tổng lượng NH3 dùng trong ngày
                    </h3>
                    <p className="text-xs text-slate-500">
                      Vận hành viên NH3 và Trưởng kíp điện nhập Mức bồn 00h và 24h của Bồn A, B, C và
                      Tổng lượng NH3 nhập trong ngày (tấn).
                    </p>
                  </div>
                  <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-800">
                    VHV NH3 · Trưởng kíp điện
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {/* Bảng mức bồn */}
                  <div className="overflow-x-auto rounded-lg border md:col-span-2">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-[#f0f4f9] text-[#173b64]">
                          <th className="p-2 text-left font-bold">Bồn NH3</th>
                          <th className="p-2 text-center font-bold">Mức 00h (mm)</th>
                          <th className="p-2 text-center font-bold">Mức 24h (mm)</th>
                          <th className="p-2 text-center font-bold">Khối lượng (tấn)</th>
                          <th className="p-2 text-center font-bold">Khả dụng 24h (tấn)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        <tr>
                          <td className="p-2 font-bold text-slate-800 font-sans">Bồn A</td>
                          <td className="p-1.5 text-center">
                            {renderCellInput("N69", { group: "nh3_tank" })}
                          </td>
                          <td className="p-1.5 text-center">
                            {renderCellInput("O69", { group: "nh3_tank" })}
                          </td>
                          <td className="p-1.5 text-center">
                            {renderCellInput("P69", { group: "nh3_tank" })}
                          </td>
                          <td className="p-2 text-right font-bold text-indigo-900">
                            {format(nh3.tankAvailable[0])}
                          </td>
                        </tr>
                        <tr>
                          <td className="p-2 font-bold text-slate-800 font-sans">Bồn B</td>
                          <td className="p-1.5 text-center">
                            {renderCellInput("N70", { group: "nh3_tank" })}
                          </td>
                          <td className="p-1.5 text-center">
                            {renderCellInput("O70", { group: "nh3_tank" })}
                          </td>
                          <td className="p-1.5 text-center">
                            {renderCellInput("P70", { group: "nh3_tank" })}
                          </td>
                          <td className="p-2 text-right font-bold text-indigo-900">
                            {format(nh3.tankAvailable[1])}
                          </td>
                        </tr>
                        <tr>
                          <td className="p-2 font-bold text-slate-800 font-sans">Bồn C</td>
                          <td className="p-1.5 text-center">
                            {renderCellInput("N71", { group: "nh3_tank" })}
                          </td>
                          <td className="p-1.5 text-center">
                            {renderCellInput("O71", { group: "nh3_tank" })}
                          </td>
                          <td className="p-1.5 text-center">
                            {renderCellInput("P71", { group: "nh3_tank" })}
                          </td>
                          <td className="p-2 text-right font-bold text-indigo-900">
                            {format(nh3.tankAvailable[2])}
                          </td>
                        </tr>
                        <tr className="border-t-2 border-slate-300 bg-indigo-50/70">
                          <td className="p-2 font-black text-[#173b64] font-sans" colSpan={3}>
                            Tổng 3 bồn
                          </td>
                          <td className="p-2 text-right font-black text-[#173b64]">
                            {format(nh3.tankMassTotal)}
                          </td>
                          <td className="p-2 text-right font-black text-indigo-900">
                            {format(nh3.tankAvailableTotal)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Tổng hợp tồn & nhập NH3 */}
                  <div className="rounded-lg bg-slate-50 p-3 text-xs border border-slate-200 space-y-2.5">
                    <span className="font-bold text-[#173b64] block">
                      Số liệu nhập & sử dụng NH3:
                    </span>
                    <label className="block">
                      <span className="text-slate-600 block mb-1">
                        Tổng lượng NH3 nhập trong ngày (tấn):
                      </span>
                      {renderCellInput("P72", { group: "nh3_tank" })}
                    </label>

                    <label className="block">
                      <span className="text-slate-600 block mb-1">
                        Tổng lượng NH3 tồn kho 00h (tấn):
                      </span>
                      {renderCellInput("P73", { group: "nh3_tank" })}
                    </label>

                    <div className="rounded bg-white p-2 border font-mono">
                      <span className="text-[11px] text-slate-500 font-sans block">
                        Tồn kho 24h00 (tấn):
                      </span>
                      <b className="text-indigo-900">
                        {format(nh3.stock24h)}
                      </b>
                    </div>

                    <div className="rounded bg-white p-2 border font-mono">
                      <span className="text-[11px] text-slate-500 font-sans block">
                        Tổng NH3 đã dùng (tấn):
                      </span>
                      <b className="text-emerald-800">
                        {format(nh3.usedTonnes)}
                      </b>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 mb-3">
                  <div>
                    <h3 className="text-sm font-black text-[#173b64]">
                      Tổng lượng NH3 dùng trong ngày tính theo công tơ trên DCS
                    </h3>
                    <p className="text-xs text-slate-500">
                      Lò trưởng hoặc Trưởng kíp điện nhập chỉ số 00h và 24h. Kết quả S1, S2 tự liên kết sang Dữ liệu các tháng.
                    </p>
                  </div>
                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                    Lò trưởng / Trưởng kíp điện
                  </span>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[1080px] text-xs">
                    <thead>
                      <tr className="bg-[#f0f4f9] text-[#173b64]">
                        <th className="p-2 text-left font-bold">Tổ máy</th>
                        <th className="p-2 text-center font-bold">Công tơ 24h ngày {previousDate.split("-").reverse().join("/")} · tự lấy (tấn)</th>
                        <th className="p-2 text-center font-bold">Công tơ 24h ngày {date.split("-").reverse().join("/")} (tấn)</th>
                        <th className="p-2 text-center font-bold">Đã dùng (tấn)</th>
                        <th className="p-2 text-center font-bold">Đầu cực MF (MWh)</th>
                        <th className="p-2 text-center font-bold">MBA (MWh)</th>
                        <th className="p-2 text-center font-bold">NH3 tiêu thụ (kg)</th>
                        <th className="p-2 text-center font-bold">Suất hao đầu cực (g/kWh)</th>
                        <th className="p-2 text-center font-bold">Suất hao trên lưới (g/kWh)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {([
                        { label: "S1", endCell: "N81", data: nh3Dcs.s1 },
                        { label: "S2", endCell: "N82", data: nh3Dcs.s2 },
                      ] as const).map(row => (
                        <tr key={row.label}>
                          <td className="p-2 font-bold text-slate-800 font-sans">Tổ máy {row.label}</td>
                          <td className="bg-blue-50 p-2 text-right font-semibold text-blue-800" title="Tự lấy từ công tơ 24h ngày D-1">
                            {format(row.data?.startTonnes ?? null)}
                          </td>
                          <td className="p-1.5 text-center">{renderCellInput(row.endCell, { group: "nh3_dcs" })}</td>
                          <td className="p-2 text-right font-bold text-emerald-800">{format(row.data?.usedTonnes ?? null)}</td>
                          <td className="p-2 text-right">{format(row.data?.grossMwh ?? null)}</td>
                          <td className="p-2 text-right">{format(row.data?.netMwh ?? null)}</td>
                          <td className="p-2 text-right">{format(row.data?.usedKg ?? null)}</td>
                          <td className="p-2 text-right">{format(row.data?.rateGross ?? null)}</td>
                          <td className="p-2 text-right">{format(row.data?.rateNet ?? null)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-slate-300 bg-emerald-50/70">
                        <td className="p-2 font-black text-[#173b64] font-sans" colSpan={3}>Tổng NH3 DCS S1 + S2</td>
                        <td className="p-2 text-right font-black text-emerald-900">{format(nh3Dcs.totalUsedTonnes)}</td>
                        <td className="p-2" colSpan={5}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: CỤM 9 & 14 — ĐIỆN TỰ DÙNG TD21 & THAN TRỘN PMIS                     */}
          {/* ========================================================================= */}
          {activeTab === "td21_coal_blend" && (
            <div className="space-y-6">
              {/* CỤM 9: CÔNG TƠ TD21 */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 mb-3">
                  <div>
                    <h3 className="text-sm font-black text-[#173b64]">
                      Cụm 9: Công tơ điện tự dùng - TD21
                    </h3>
                    <p className="text-xs text-slate-500">
                      Trực phụ điện nhập chỉ số tại 4 mốc: 06h, 14h, 22h, 24h.
                    </p>
                  </div>
                  <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-800">
                    Trực phụ điện
                  </span>
                </div>

                <div className="overflow-x-auto rounded-lg border max-w-xl">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#f0f4f9] text-[#173b64]">
                        <th className="p-2 text-left font-bold">Tên công tơ</th>
                        <th className="p-2 text-center font-bold">06h</th>
                        <th className="p-2 text-center font-bold">14h</th>
                        <th className="p-2 text-center font-bold">22h</th>
                        <th className="p-2 text-center font-bold">24h</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      <tr>
                        <td className="p-2 font-bold text-slate-800 font-sans">
                          Công tơ điện tự dùng - TD21
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("M49", { group: "td21" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("O49", { group: "td21" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("Q49", { group: "td21" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("R49", { group: "td21" })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CỤM 14: THAN TRỘN PMIS */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 mb-3">
                  <div>
                    <h3 className="text-sm font-black text-[#173b64]">
                      Cụm 14: Bảng than 6A10 theo ca
                    </h3>
                    <p className="text-xs text-slate-500">
                      Bố cục theo file Excel: chỉ nhập độ ẩm Wtp và nhiệt trị khô Qk; khối lượng than
                      chưa quy ẩm, quy ẩm 8,5% và nhiệt trị thực tế được tính tự động.
                    </p>
                  </div>
                  <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-800">
                    Trưởng kíp điện
                  </span>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <table className="min-w-[980px] w-full text-xs">
                    <thead>
                      <tr className="bg-[#f0f4f9] text-[#173b64]">
                        <th className="p-2 text-center font-bold">Tổ máy</th>
                        <th className="p-2 text-center font-bold">Ca</th>
                        <th className="p-2 text-center font-bold">Than chưa quy ẩm (t)</th>
                        <th className="p-2 text-center font-bold bg-yellow-50">Ẩm toàn phần Wtp (%)</th>
                        <th className="p-2 text-center font-bold bg-yellow-50">Nhiệt trị khô Qk (kcal/kg)</th>
                        <th className="p-2 text-center font-bold">Than quy ẩm 8,5% (t)</th>
                        <th className="p-2 text-center font-bold">Nhiệt trị thực tế (kcal/kg)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {coalShiftDetails.map((item, index) => {
                        const row = 87 + index;
                        return (
                          <tr key={`${item.unit}-${item.shift}`} className={item.unit === "S2" ? "bg-slate-50/60" : "bg-white"}>
                            <td className="p-2 text-center font-sans font-extrabold text-[#173b64]">{item.unit}</td>
                            <td className="p-2 text-center font-sans font-semibold">Ca {item.shift}</td>
                            <td className="p-2 text-right tabular-nums">{format(item.rawCoalTonnes)}</td>
                            <td className="p-1.5 bg-yellow-50/60">{renderCellInput(`AJ${row}`, { group: "coal_blend_pmis" })}</td>
                            <td className="p-1.5 bg-yellow-50/60">{renderCellInput(`AK${row}`, { group: "coal_blend_pmis" })}</td>
                            <td className="p-2 text-right tabular-nums">{format(item.adjustedCoalTonnes)}</td>
                            <td className="p-2 text-right tabular-nums">{format(item.asReceivedKcalKg)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: CỤM 11 — KHỞI ĐỘNG / NGỪNG TỔ MÁY (KHỐI THU GỌN)                    */}
          {/* ========================================================================= */}
          {activeTab === "startup_shutdown" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-300 bg-amber-50/60 p-4 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 pb-2 mb-3">
                  <div>
                    <h3 className="text-sm font-black text-amber-950">
                      Cụm 11: Sự kiện tổ máy và công tơ dầu
                    </h3>
                    <p className="text-xs text-amber-900">
                      Chỉ nhập khi có sự kiện khởi động, ngừng tổ máy hoặc đốt dầu do sự cố.
                    </p>
                  </div>
                  <span className="rounded-md bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-900">
                    Trưởng ca · Trưởng kíp điện · Lò phó
                  </span>
                </div>

                <div className="mb-3 grid gap-3 rounded-lg border border-amber-200 bg-white p-3 sm:grid-cols-2">
                  <div>
                    <span className="mb-1.5 block text-xs font-bold text-amber-950">Tổ máy</span>
                    <div className="grid grid-cols-2 gap-2">
                      {STARTUP_UNITS.map(item => (
                        <button
                          key={item.value}
                          type="button"
                          disabled={!canEditStartupMetadata || loading}
                          onClick={() => update("STARTUP_UNIT", item.value)}
                          className={`h-9 rounded-lg border text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${startupUnit === item.value
                            ? "border-amber-700 bg-amber-700 text-white"
                            : "border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="mb-1.5 block text-xs font-bold text-amber-950">Loại sự kiện</span>
                    <div className="grid grid-cols-3 gap-2">
                      {STARTUP_EVENTS.map(item => (
                        <button
                          key={item.value}
                          type="button"
                          disabled={!canEditStartupMetadata || loading}
                          onClick={() => update("STARTUP_EVENT", item.value)}
                          className={`min-h-9 rounded-lg border px-2 text-xs font-bold leading-tight transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${startupEvent === item.value
                            ? "border-amber-700 bg-amber-700 text-white"
                            : "border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {(!startupUnit || !startupEvent) && (
                  <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                    Hãy chọn rõ tổ máy S1/S2 và loại sự kiện trước khi nhập số liệu công tơ dầu.
                  </div>
                )}

                {oilEventConfig ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 rounded-lg border border-orange-200 bg-orange-50/60 p-3 sm:grid-cols-2 lg:grid-cols-4">
                      {oilEventConfig.columns.map(item => (
                        <label key={item.timeCell} className="grid gap-1 text-xs font-bold text-orange-950">
                          {item.timeLabel}
                          {renderCellInput(item.timeCell, { group: "startup_shutdown", isNumber: false, placeholder: "HH:mm" })}
                        </label>
                      ))}
                      {startupEvent === "startup" && (
                        <label className="grid gap-1 text-xs font-bold text-orange-950">
                          Tải tối thiểu khi cắt dầu (MW)
                          {renderCellInput("STARTUP_MIN_LOAD_MW", { group: "startup_shutdown", placeholder: "MW" })}
                        </label>
                      )}
                    </div>

                    <div className="overflow-x-auto rounded-lg border bg-white">
                      <table className="w-full min-w-[720px] text-xs">
                        <thead>
                          <tr className="bg-[#fef9f0] text-amber-950">
                            <th className="w-64 p-2 text-left font-bold">Chỉ số công tơ dầu · {startupUnit || "chưa chọn tổ máy"}</th>
                            {oilEventConfig.columns.map(item => (
                              <th key={item.column} className="p-2 text-center font-bold">{item.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          <tr>
                            <td className="p-2 font-sans font-bold text-slate-800">Công tơ dầu cấp lò</td>
                            {oilEventConfig.columns.map(item => (
                              <td key={item.column} className="p-1.5">{renderCellInput(`${item.column}87`, { group: "startup_shutdown" })}</td>
                            ))}
                          </tr>
                          <tr>
                            <td className="p-2 font-sans font-bold text-slate-800">Công tơ dầu hồi về</td>
                            {oilEventConfig.columns.map(item => (
                              <td key={item.column} className="p-1.5">{renderCellInput(`${item.column}88`, { group: "startup_shutdown" })}</td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className={`grid gap-2 ${oilEventConfig.phaseLabels.length > 1 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                      {oilEventConfig.phaseLabels.map((label, index) => (
                        <div key={label} className="rounded-lg border border-orange-200 bg-white p-3 text-center">
                          <div className="text-[11px] font-semibold text-slate-500">{label}</div>
                          <div className="mt-1 text-base font-black text-orange-800">{format(oilEventSummary?.phaseTonnes[index] ?? null)} tấn</div>
                        </div>
                      ))}
                      <div className="rounded-lg border border-orange-300 bg-orange-100 p-3 text-center">
                        <div className="text-[11px] font-bold text-orange-900">Tổng dầu sự kiện</div>
                        <div className="mt-1 text-base font-black text-orange-950">{format(oilEventSummary?.totalTonnes ?? null)} tấn</div>
                      </div>
                    </div>
                    <p className="text-[11px] font-semibold text-orange-900">
                      Công thức từng giai đoạn: (công tơ cấp cuối − công tơ cấp đầu) − (công tơ hồi cuối − công tơ hồi đầu).
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs font-semibold text-slate-600">
                    Chọn loại sự kiện để hệ thống chỉ hiện đúng các mốc công tơ cần nhập.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 6: BÁO CÁO PMIS 02-PĐ & ĐỐI CHIẾU NGÀY (SẢN LƯỢNG & CHỈ TIÊU KTKT)     */}
          {/* ========================================================================= */}
          {activeTab === "pmis_reports" && (() => {
            const j157 = num(current, "J157");
            const k157 = num(current, "K157");
            const l157 = j157 !== null && k157 !== null ? j157 - k157 : null;

            const j158 = num(current, "J158");
            const k158 = num(current, "K158");
            const l158 = j158 !== null && k158 !== null ? j158 - k158 : null;

            const jSum = (j157 ?? 0) + (j158 ?? 0);
            const kSum = (k157 ?? 0) + (k158 ?? 0);
            const lSum = (l157 ?? 0) + (l158 ?? 0);

            const canEditPmis = userCanEditAny || canEditCtktktGroup(user, "pmis_reports");

            return (
              <div className="space-y-6">
                {/* Thanh công cụ và điều khiển đồng bộ QLKT */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-[#173b64]">
                        Báo cáo PMIS 02-PĐ &amp; Đối chiếu ngày (Sản lượng &amp; Chỉ tiêu KTKT)
                      </h3>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${extensionOutdated ? "bg-amber-50 text-amber-700" : extensionVersion ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${extensionOutdated ? "bg-amber-500" : extensionVersion ? "bg-emerald-500" : "bg-amber-500"}`} />
                        {extensionOutdated ? `Tiện ích v${extensionVersion} · web tự tương thích` : extensionVersion ? `Tiện ích v${extensionVersion}` : "Chưa kết nối tiện ích"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Chỉ lấy tự động từ QLKT (mục Sản lượng DH1_MF1/MF2 và mục 02-PĐ hàng Duyên Hải 1), không dùng công tơ và không nhập tay. Các số liệu này tự động liên kết sang Cụm 1 và Mục 2 của BCSX S1, S2, A0.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={syncingPmis || !canEditPmis}
                      onClick={syncPmis02PdFromQlkt}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#4057b5] to-[#438ec1] px-3.5 py-2 text-xs font-bold text-white shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCw className={`size-3.5 ${syncingPmis ? "animate-spin" : ""}`} />
                      {syncingPmis ? "Đang đồng bộ PMIS…" : "Đồng bộ PMIS & 02-PĐ"}
                    </button>
                    <button
                      type="button"
                      disabled={saving || !userCanEditAny}
                      onClick={() => void save()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Save className="size-3.5" />
                      {saving ? "Đang lưu…" : "Lưu số liệu"}
                    </button>
                  </div>
                </div>

                {/* BẢNG 1: PMIS => Sản xuất điện => Vận hành => Sản lượng (Dòng 155 - 158) */}
                <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
                  <div className="border-b border-slate-300 bg-white px-4 py-2.5 text-center">
                    <div className="text-sm font-extrabold text-red-600">
                      PMIS =&gt; Sản xuất điện =&gt; Vận hành =&gt; Sản lượng
                    </div>
                    <div className="text-[11px] font-semibold text-red-500 italic">
                      (Nhập số chú ý khoảng trắng và đơn vị)
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-[#173b64]">
                          <th className="border border-slate-300 px-3 py-2 text-center font-bold w-24">
                            Tổ máy
                          </th>
                          <th className="border border-slate-300 px-3 py-2 text-center font-bold">
                            Điện đầu cực PMIS<br />
                            <span className="font-normal text-slate-500">(MW)</span>
                          </th>
                          <th className="border border-slate-300 px-3 py-2 text-center font-bold">
                            Điện năng xuất tuyến PMIS<br />
                            <span className="font-normal text-slate-500">(MW)</span>
                          </th>
                          <th className="border border-slate-300 px-3 py-2 text-center font-bold">
                            Tổng tự dùng PMIS<br />
                            <span className="font-normal text-slate-500">(MW)</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Tổ máy S1 */}
                        <tr className="bg-[#008000] text-white">
                          <td className="border border-slate-400 px-3 py-2 text-center font-bold text-white bg-[#006e00]">
                            S1
                          </td>
                          <td className="border border-slate-400 p-1">
                            {renderCellInput("J157", {
                              group: "pmis_reports",
                              className: "!bg-[#008000] !text-red-300 !border-[#009e00] font-bold text-sm text-right focus:!bg-[#005a00] focus:!text-white",
                              placeholder: "10472.680",
                            })}
                          </td>
                          <td className="border border-slate-400 p-1">
                            {renderCellInput("K157", {
                              group: "pmis_reports",
                              className: "!bg-[#008000] !text-red-300 !border-[#009e00] font-bold text-sm text-right focus:!bg-[#005a00] focus:!text-white",
                              placeholder: "9631.526",
                            })}
                          </td>
                          <td className="border border-slate-400 px-3 py-2 text-right font-mono font-bold text-red-300 text-sm">
                            {l157 !== null ? format(l157) : "—"}
                          </td>
                        </tr>

                        {/* Tổ máy S2 */}
                        <tr className="bg-[#008000] text-white">
                          <td className="border border-slate-400 px-3 py-2 text-center font-bold text-white bg-[#006e00]">
                            S2
                          </td>
                          <td className="border border-slate-400 p-1">
                            {renderCellInput("J158", {
                              group: "pmis_reports",
                              className: "!bg-[#008000] !text-red-300 !border-[#009e00] font-bold text-sm text-right focus:!bg-[#005a00] focus:!text-white",
                              placeholder: "10474.000",
                            })}
                          </td>
                          <td className="border border-slate-400 p-1">
                            {renderCellInput("K158", {
                              group: "pmis_reports",
                              className: "!bg-[#008000] !text-red-300 !border-[#009e00] font-bold text-sm text-right focus:!bg-[#005a00] focus:!text-white",
                              placeholder: "9593.341",
                            })}
                          </td>
                          <td className="border border-slate-400 px-3 py-2 text-right font-mono font-bold text-red-300 text-sm">
                            {l158 !== null ? format(l158) : "—"}
                          </td>
                        </tr>

                        {/* Toàn nhà máy */}
                        <tr className="bg-slate-100 font-bold text-[#173b64]">
                          <td className="border border-slate-300 px-3 py-2 text-center font-extrabold">
                            Toàn NM
                          </td>
                          <td className="border border-slate-300 px-3 py-2 text-right font-mono text-sm">
                            {(j157 !== null || j158 !== null) ? format(jSum) : "—"}
                          </td>
                          <td className="border border-slate-300 px-3 py-2 text-right font-mono text-sm">
                            {(k157 !== null || k158 !== null) ? format(kSum) : "—"}
                          </td>
                          <td className="border border-slate-300 px-3 py-2 text-right font-mono text-sm">
                            {(l157 !== null || l158 !== null) ? format(lSum) : "—"}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      💡 <b>Liên kết trực tiếp:</b> Số liệu Điện đầu cực (J157, J158) và Xuất tuyến (K157, K158) ở đây tự động làm nguồn cho <b>Cụm 1 · Thống kê chỉ tiêu KTKT</b> và <b>Mục 2 của Báo cáo sản xuất (BCSX)</b> cho cả 3 file S1, S2, A0.
                    </span>
                    <span className="text-slate-500">Công thức: Tự dùng PMIS = Đầu cực − Xuất tuyến</span>
                  </div>
                </div>

                {/* BẢNG 2: PMIS => Sản xuất điện => Báo cáo => Báo cáo chỉ tiêu kinh tế kỹ thuật số 02 - PĐ (Dòng 178 - 181) */}
                <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
                  <div className="border-b border-slate-300 bg-white px-4 py-2.5 text-center">
                    <div className="text-sm font-extrabold text-[#173b64]">
                      PMIS =&gt; Sản xuất điện =&gt; Báo cáo =&gt; Báo cáo chỉ tiêu kinh tế kỹ thuật số 02 - PĐ
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500">
                      Đồng bộ trực tiếp từ hàng <b>&quot;Duyên Hải 1&quot;</b> trên màn hình QLKT 02-PĐ (rpt_CT_QLKT_02_PD_New.jsf)
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs whitespace-nowrap">
                      <thead>
                        {/* Hàng tiêu đề cấp 1 */}
                        <tr className="bg-slate-100 text-[#173b64] font-bold text-center">
                          <th className="border border-slate-300 px-2 py-1.5" colSpan={1}>Công suất NMĐ</th>
                          <th className="border border-slate-300 px-2 py-1.5" colSpan={2}>Điện năng đầu cực MF</th>
                          <th className="border border-slate-300 px-2 py-1.5" colSpan={3}>Điện năng giao nhận</th>
                          <th className="border border-slate-300 px-2 py-1.5" colSpan={2}>Tổn thất MBA</th>
                          <th className="border border-slate-300 px-2 py-1.5" colSpan={2}>Điện tự dùng</th>
                          <th className="border border-slate-300 px-2 py-1.5" colSpan={1}>Lượng nhiên liệu sử dụng</th>
                          <th className="border border-slate-300 px-2 py-1.5" colSpan={4}>Suất hao nhiên liệu</th>
                          <th className="border border-slate-300 px-2 py-1.5" rowSpan={2}>Hệ số sử dụng</th>
                          <th className="border border-slate-300 px-2 py-1.5" rowSpan={2}>Hệ số đáp ứng</th>
                          <th className="border border-slate-300 px-2 py-1.5" rowSpan={2}>Độ phát thải</th>
                        </tr>
                        {/* Hàng tiêu đề cấp 2 */}
                        <tr className="bg-slate-50 text-slate-700 font-bold text-center text-[11px]">
                          <th className="border border-slate-300 px-2 py-1">Công suất đặt</th>
                          <th className="border border-slate-300 px-2 py-1">Điện năng tác dụng</th>
                          <th className="border border-slate-300 px-2 py-1">Điện năng phản kháng</th>
                          <th className="border border-slate-300 px-2 py-1">Điện năng giao</th>
                          <th className="border border-slate-300 px-2 py-1">Điện năng nhận</th>
                          <th className="border border-slate-300 px-2 py-1">Điện năng nhận chạy bù</th>
                          <th className="border border-slate-300 px-2 py-1">MBA kích từ</th>
                          <th className="border border-slate-300 px-2 py-1">MBA nâng</th>
                          <th className="border border-slate-300 px-2 py-1">Điện năng tự dùng</th>
                          <th className="border border-slate-300 px-2 py-1">k tự dùng</th>
                          <th className="border border-slate-300 px-2 py-1">Nhiên liệu sử dụng</th>
                          <th className="border border-slate-300 px-2 py-1">Suất hao nhiên liệu thô</th>
                          <th className="border border-slate-300 px-2 py-1">Suất hao nhiên liệu tinh</th>
                          <th className="border border-slate-300 px-2 py-1">Suất hao nhiệt thô</th>
                          <th className="border border-slate-300 px-2 py-1">Suất hao nhiệt tinh</th>
                        </tr>
                        {/* Hàng đơn vị */}
                        <tr className="bg-slate-50/70 text-slate-500 text-[10px] text-center italic">
                          <th className="border border-slate-300 px-2 py-0.5 font-normal">(MW)</th>
                          <th className="border border-slate-300 px-2 py-0.5 font-normal">(Tr. kWh)</th>
                          <th className="border border-slate-300 px-2 py-0.5 font-normal">(Tr. kVArh)</th>
                          <th className="border border-slate-300 px-2 py-0.5 font-normal">(Tr. kWh)</th>
                          <th className="border border-slate-300 px-2 py-0.5 font-normal">(Tr. kWh)</th>
                          <th className="border border-slate-300 px-2 py-0.5 font-normal">(Tr. kWh)</th>
                          <th className="border border-slate-300 px-2 py-0.5 font-normal">(Tr. kWh)</th>
                          <th className="border border-slate-300 px-2 py-0.5 font-normal">(Tr. kWh)</th>
                          <th className="border border-slate-300 px-2 py-0.5 font-normal">(Tr. kWh)</th>
                          <th className="border border-slate-300 px-2 py-0.5 font-normal">%</th>
                          <th className="border border-slate-300 px-2 py-0.5 font-normal">Tr. Tấn / Tr. BTU</th>
                          <th className="border border-slate-300 px-2 py-0.5 font-normal">g/kWh</th>
                          <th className="border border-slate-300 px-2 py-0.5 font-normal">g/kWh</th>
                          <th className="border border-slate-300 px-2 py-0.5 font-normal">kJ/kWh</th>
                          <th className="border border-slate-300 px-2 py-0.5 font-normal">kJ/kWh</th>
                          <th className="border border-slate-300 px-2 py-0.5 font-normal"> </th>
                          <th className="border border-slate-300 px-2 py-0.5 font-normal"> </th>
                          <th className="border border-slate-300 px-2 py-0.5 font-normal">(Đạt / Ko đạt)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Dòng 181 nhập liệu */}
                        <tr className="bg-[#008000] text-white">
                          <td className="border border-slate-400 p-1 w-24">
                            {renderCellInput("C181", { group: "pmis_reports", className: "!bg-[#008000] !text-red-300 !border-[#009e00] font-bold text-xs text-right focus:!bg-[#005a00] focus:!text-white", placeholder: "1245" })}
                          </td>
                          <td className="border border-slate-400 p-1 w-28">
                            {renderCellInput("D181", { group: "pmis_reports", className: "!bg-[#008000] !text-red-300 !border-[#009e00] font-bold text-xs text-right focus:!bg-[#005a00] focus:!text-white", placeholder: "20.9467" })}
                          </td>
                          <td className="border border-slate-400 p-1 w-24">
                            {renderCellInput("E181", { group: "pmis_reports", className: "!bg-[#008000] !text-red-300 !border-[#009e00] font-bold text-xs text-right focus:!bg-[#005a00] focus:!text-white", placeholder: "0" })}
                          </td>
                          <td className="border border-slate-400 p-1 w-28">
                            {renderCellInput("F181", { group: "pmis_reports", className: "!bg-[#008000] !text-red-300 !border-[#009e00] font-bold text-xs text-right focus:!bg-[#005a00] focus:!text-white", placeholder: "19.2249" })}
                          </td>
                          <td className="border border-slate-400 p-1 w-24">
                            {renderCellInput("G181", { group: "pmis_reports", className: "!bg-[#008000] !text-red-300 !border-[#009e00] font-bold text-xs text-right focus:!bg-[#005a00] focus:!text-white", placeholder: "0" })}
                          </td>
                          <td className="border border-slate-400 p-1 w-24">
                            {renderCellInput("H181", { group: "pmis_reports", className: "!bg-[#008000] !text-red-300 !border-[#009e00] font-bold text-xs text-right focus:!bg-[#005a00] focus:!text-white", placeholder: "0" })}
                          </td>
                          <td className="border border-slate-400 p-1 w-24">
                            {renderCellInput("I181", { group: "pmis_reports", className: "!bg-[#008000] !text-red-300 !border-[#009e00] font-bold text-xs text-right focus:!bg-[#005a00] focus:!text-white", placeholder: "0" })}
                          </td>
                          <td className="border border-slate-400 p-1 w-24">
                            {renderCellInput("J181", { group: "pmis_reports", className: "!bg-[#008000] !text-red-300 !border-[#009e00] font-bold text-xs text-right focus:!bg-[#005a00] focus:!text-white", placeholder: "0" })}
                          </td>
                          <td className="border border-slate-400 p-1 w-28">
                            {renderCellInput("K181", { group: "pmis_reports", className: "!bg-[#008000] !text-red-300 !border-[#009e00] font-bold text-xs text-right focus:!bg-[#005a00] focus:!text-white", placeholder: "1.7218" })}
                          </td>
                          <td className="border border-slate-400 p-1 w-24">
                            {renderCellInput("L181", { group: "pmis_reports", className: "!bg-[#008000] !text-red-300 !border-[#009e00] font-bold text-xs text-right focus:!bg-[#005a00] focus:!text-white", placeholder: "8.22" })}
                          </td>
                          <td className="border border-slate-400 p-1 w-28">
                            {renderCellInput("M181", { group: "pmis_reports", className: "!bg-[#008000] !text-red-300 !border-[#009e00] font-bold text-xs text-right focus:!bg-[#005a00] focus:!text-white", placeholder: "0.0102" })}
                          </td>
                          <td className="border border-slate-400 p-1 w-28">
                            {renderCellInput("N181", { group: "pmis_reports", className: "!bg-[#008000] !text-red-300 !border-[#009e00] font-bold text-xs text-right focus:!bg-[#005a00] focus:!text-white", placeholder: "489.2526" })}
                          </td>
                          <td className="border border-slate-400 p-1 w-28">
                            {renderCellInput("O181", { group: "pmis_reports", className: "!bg-[#008000] !text-red-300 !border-[#009e00] font-bold text-xs text-right focus:!bg-[#005a00] focus:!text-white", placeholder: "533.0709" })}
                          </td>
                          <td className="border border-slate-400 p-1 w-28">
                            {renderCellInput("P181", { group: "pmis_reports", className: "!bg-[#008000] !text-red-300 !border-[#009e00] font-bold text-xs text-right focus:!bg-[#005a00] focus:!text-white", placeholder: "9710.6908" })}
                          </td>
                          <td className="border border-slate-400 p-1 w-28">
                            {renderCellInput("Q181", { group: "pmis_reports", className: "!bg-[#008000] !text-red-300 !border-[#009e00] font-bold text-xs text-right focus:!bg-[#005a00] focus:!text-white", placeholder: "10580.3974" })}
                          </td>
                          <td className="border border-slate-400 p-1 w-24">
                            {renderCellInput("R181", { group: "pmis_reports", className: "!bg-[#008000] !text-red-300 !border-[#009e00] font-bold text-xs text-right focus:!bg-[#005a00] focus:!text-white", placeholder: "0.701" })}
                          </td>
                          <td className="border border-slate-400 p-1 w-24">
                            {renderCellInput("S181", { group: "pmis_reports", className: "!bg-[#008000] !text-red-300 !border-[#009e00] font-bold text-xs text-right focus:!bg-[#005a00] focus:!text-white", placeholder: "0" })}
                          </td>
                          <td className="border border-slate-400 p-1 w-24">
                            {renderCellInput("T181", { group: "pmis_reports", isNumber: false, className: "!bg-[#008000] !text-red-300 !border-[#009e00] font-bold text-xs text-center focus:!bg-[#005a00] focus:!text-white", placeholder: "Đạt" })}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      📋 <b>Mẹo thao tác:</b> Có thể dùng phím mũi tên <b>← ↑ → ↓</b> hoặc <b>Enter/Tab</b> để di chuyển giữa các ô, hoặc copy toàn bộ hàng số liệu từ Excel / QLKT rồi bấm <b>Ctrl+V</b> vào ô đầu tiên để dán hàng loạt.
                    </span>
                    <span className="font-semibold text-slate-500">Dòng 181 (C181:T181)</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ========================================================================= */}
          {/* TAB 7: TRA CỨU TOÀN BỘ Ô (LƯỚI / TÌM KIẾM CHO KỸ THUẬT VIÊN)              */}
          {/* ========================================================================= */}
          {activeTab === "all_fields" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-2">
                <div className="flex items-center gap-2">
                  <label className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 text-xs text-slate-600 focus-within:border-indigo-500 focus-within:bg-white">
                    <Search className="size-3.5 text-slate-400" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Tìm mã ô (W8, M9...) hoặc tên..."
                      className="w-56 bg-transparent outline-none"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="text-slate-400 hover:text-slate-700"
                      >
                        ✕
                      </button>
                    )}
                  </label>
                  <span className="text-xs text-slate-500">
                    Hiển thị {editableFields.length} ô nhập tay
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 max-h-[600px] overflow-y-auto p-1">
                {editableFields
                  .filter(f => {
                    if (!search.trim()) return true;
                    const q = search.trim().toLowerCase();
                    return (
                      f.cell.toLowerCase().includes(q) ||
                      (f.label && f.label.toLowerCase().includes(q))
                    );
                  })
                  .map(f => {
                    const canEditThis = canEditCtktktField(user, f.cell);
                    return (
                      <div
                        key={f.cell}
                        className={`flex items-center justify-between gap-2 rounded-lg border p-1.5 text-xs ${
                          canEditThis
                            ? "border-slate-200 bg-white hover:border-indigo-300"
                            : "border-slate-200 bg-slate-100/70"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <code className="font-mono text-[10px] font-bold text-slate-700">
                              {f.cell}
                            </code>
                            {!canEditThis && <Lock className="size-2.5 text-slate-400" />}
                          </div>
                          <span
                            className="text-[10px] text-slate-600 truncate block leading-tight"
                            title={f.label}
                          >
                            {f.label}
                          </span>
                        </div>
                        <div className="w-20 shrink-0">
                          {renderCellInput(f.cell, { compact: true })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Footer ghi chú tổng kết */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-[#fffbeb] px-4 py-2 text-[11px] text-amber-900">
          <span>
            <b>Lưu ý nghiệp vụ:</b> Các cụm phụ (Lò hơi phụ, Nước sử dụng, Mực bồn HFO, Suất hao
            nhiệt) đã được lược bớt trên giao diện web theo quy trình vận hành và giữ đầy đủ trong
            file xuất Excel.
          </span>
          <span className="font-semibold text-amber-800">
            {editableFields.length} ô nhập tay · 42 ô liên kết BCSX
          </span>
        </div>
      </div>

      {showEmailModal && (
        <CtktktEmailModal
          isOpen={showEmailModal}
          onClose={() => setShowEmailModal(false)}
          operatingDate={date}
          currentEntries={current}
          previousEntries={previous}
          initialShiftName="Tổ C"
        />
      )}
    </section>
  );
}
