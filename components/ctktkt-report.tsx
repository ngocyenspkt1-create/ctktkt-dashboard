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
  Database,
  RefreshCw,
  Mail,
  Upload,
} from "lucide-react";
import { DateField } from "@/components/ui/date-field";
import { CtktktEmailModal } from "@/components/ctktkt-email-modal";
import { useSessionUser } from "@/components/session-context";
import {
  canEditAnyCtktktField,
  canEditCtktktField,
  canEditCtktktGroup,
  getEditableCtktktGroups,
  CTKTKT_GROUP_META,
  type CtktktFieldGroup,
} from "@/lib/ctktkt-permissions";
import { CTKTKT_BCSX_LINKED_CELLS, CTKTKT_BCSX_LINKS } from "@/lib/ctktkt-bcsx-link";
import {
  calculateCtktktSummary,
  calculateTkdDcsSummary,
  calculateOilDifferences,
  calculateSteamDifferences,
  calculateNh3Summary,
  previousIsoDate,
  TKD_HOURS,
  OIL_HOURS,
  STEAM_HOURS,
  type CtktktDayEntries,
  type CtktktKpis,
} from "@/lib/ctktkt-report";
import { CTKTKT_INPUT_FIELDS } from "@/lib/ctktkt-fields.generated";
import {
  CTKTKT_EXTRA_INPUT_FIELDS,
  CTKTKT_LEGACY_UNUSED_COAL_BLEND_CELLS,
} from "@/lib/ctktkt-extra-fields";
import { parseSpreadsheetClipboard } from "@/lib/spreadsheet-grid";

type LoadedEntry = { operatingDate: string; cell: string; value: string };
type LinkWarning = { operatingDate: string; cell: string; message: string };
type DisplayField = { cell: string; label: string; row: number; column: number };
type ImportEntry = { cell: string; value: string };
type ImportShiftEntry = { unit: string; timeSlot: string; metric: string; value: string };
type ImportDay = { date: string; sheetName: string; manualEntries: ImportEntry[]; shiftEntries: ImportShiftEntry[] };
type ImportPackage = {
  month: string;
  throughDay: number;
  days: ImportDay[];
  totals: { failed: number; checks: number; passed: number };
};

type MainTab =
  | "tkd_dcs"
  | "unit_meters"
  | "steam_nh3"
  | "td21_coal_blend"
  | "startup_shutdown"
  | "pmis_reports"
  | "all_fields";

const today = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const editableFields = [
  ...CTKTKT_INPUT_FIELDS.filter(
    field => !CTKTKT_BCSX_LINKED_CELLS.has(field.cell)
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

function format(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return numberFormat.format(value);
}

function num(entries: CtktktDayEntries, cell: string): number | null {
  const v = entries[cell]?.trim().replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function CtktktReport() {
  const user = useSessionUser();
  const userCanEditAny = canEditAnyCtktktField(user);
  const editableGroups = useMemo(() => getEditableCtktktGroups(user), [user]);

  const [date, setDate] = useState("2026-09-17");
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
  const [seeding, setSeeding] = useState(false);
  const [importingHistory, setImportingHistory] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [isKpiCollapsed, setIsKpiCollapsed] = useState(false);
  const [allViewMode, setAllViewMode] = useState<"dense" | "matrix" | "cards">("dense");
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [extensionVersion, setExtensionVersion] = useState("");
  const [syncingPmis, setSyncingPmis] = useState(false);
  const pmisRequestRef = useRef<{ id: string; timer: number; operatingDate: string } | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);

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
      const updates: Record<string, string> = {};
      for (const entry of payload.entries) {
        updates[entry.cell] = entry.value;
      }
      setByDate(old => ({
        ...old,
        [request.operatingDate]: {
          ...(old[request.operatingDate] || {}),
          ...updates,
        },
      }));
      setDirty(false);
      try {
        const res = await fetch("/api/ctktkt-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operatingDate: request.operatingDate,
            entries: payload.entries,
          }),
        });
        const resJson = (await res.json()) as { error?: string; saved?: number };
        if (!res.ok || resJson.error) {
          throw new Error(resJson.error || "Không lưu được dữ liệu đồng bộ.");
        }
        setMessage(`Đã đồng bộ và lưu thành công ${payload.entries.length} chỉ tiêu PMIS Sản lượng & 02-PĐ (hàng Duyên Hải 1) từ QLKT cho ngày ${request.operatingDate.split("-").reverse().join("/")}!`);
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

  const current = useMemo(
    () => ({ ...(byDate[date] || {}), ...(linkedByDate[date] || {}) }),
    [byDate, linkedByDate, date],
  );

  const previousDate = previousIsoDate(date);
  const previous = useMemo(() => {
    const manual = byDate[previousDate];
    const linked = linkedByDate[previousDate];
    return manual || linked ? { ...(manual || {}), ...(linked || {}) } : undefined;
  }, [byDate, linkedByDate, previousDate]);

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

  const update = (cell: string, value: string) => {
    setByDate(old => ({
      ...old,
      [date]: { ...(old[date] || {}), [cell]: value },
    }));
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
      // Gửi các ô được phép nhập
      const toSend = editableFields.map(field => ({
        cell: field.cell,
        value: current[field.cell] || "",
      }));

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
      setDirty(false);
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
      setError("Chưa kết nối tiện ích QLKT. Hãy Reload tiện ích phiên bản 0.4.23 rồi thử lại.");
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

  const handleSeedSample = async () => {
    setSeeding(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/ctktkt-report/seed-sample", { method: "POST" });
      const body = (await response.json()) as { error?: string; totalManual?: number; totalShift?: number };
      if (!response.ok) throw new Error(body.error || "Không nạp được số liệu mẫu.");

      setDate("2026-09-17");
      setDirty(false);
      setLoading(true);
      const res = await fetch(`/api/ctktkt-report?period=2026-09`, { cache: "no-store" });
      const resBody = (await res.json()) as {
        entries?: LoadedEntry[];
        linkedEntries?: LoadedEntry[];
        warnings?: LinkWarning[];
        error?: string;
      };
      if (!res.ok) throw new Error(resBody.error || "Không tải lại được dữ liệu.");

      const next: Record<string, CtktktDayEntries> = {};
      for (const entry of resBody.entries || []) {
        next[entry.operatingDate] ||= {};
        next[entry.operatingDate][entry.cell] = entry.value;
      }
      const nextLinked: Record<string, CtktktDayEntries> = {};
      for (const entry of resBody.linkedEntries || []) {
        nextLinked[entry.operatingDate] ||= {};
        nextLinked[entry.operatingDate][entry.cell] = entry.value;
      }
      setByDate(next);
      setLinkedByDate(nextLinked);
      setLinkWarnings(resBody.warnings || []);
      setMessage(
        "Đã nạp thành công dữ liệu mẫu 2 ngày (16/09 & 17/09/2026). Toàn bộ KPI ngày 17/09 đã tự động tính toán so với ngày 16/09. Bạn có thể kiểm tra các cụm hoặc bấm 'Xuất Excel tháng' để tải file!",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Lỗi khi nạp dữ liệu mẫu.");
    } finally {
      setSeeding(false);
      setLoading(false);
    }
  };

  const handleHistoryImport = async (file: File | undefined) => {
    if (!file || !userCanEditAny) return;
    setImportingHistory(true);
    setError("");
    setMessage("");
    const completed: ImportDay[] = [];
    let backup: {
      report: { entries?: LoadedEntry[]; linkedEntries?: LoadedEntry[]; warnings?: LinkWarning[] };
      shifts: Record<string, ImportShiftEntry[]>;
      importedDays: ImportDay[];
    } | null = null;

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
      const parsed = JSON.parse(await file.text()) as Partial<ImportPackage>;
      if (!/^\d{4}-\d{2}$/.test(parsed.month || "") || !Array.isArray(parsed.days) || !parsed.days.length) {
        throw new Error("Gói nhập không đúng cấu trúc CTKTKT.");
      }
      if (!parsed.totals || parsed.totals.failed !== 0 || parsed.totals.checks !== parsed.totals.passed) {
        throw new Error("Gói nhập chưa đạt đối chiếu công thức 100%; chưa ghi dữ liệu.");
      }
      const importPackage = parsed as ImportPackage;
      for (const day of importPackage.days) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !Array.isArray(day.manualEntries) || day.manualEntries.length > 400 || !Array.isArray(day.shiftEntries) || day.shiftEntries.length > 400) {
          throw new Error(`Dữ liệu ngày ${day.date || "không rõ"} không hợp lệ.`);
        }
      }

      const reportResponse = await fetch(`/api/ctktkt-report?period=${encodeURIComponent(importPackage.month)}`, { cache: "no-store" });
      const reportBackup = (await reportResponse.json()) as { entries?: LoadedEntry[]; linkedEntries?: LoadedEntry[]; warnings?: LinkWarning[]; error?: string };
      if (!reportResponse.ok) throw new Error(reportBackup.error || "Không sao lưu được dữ liệu CTKTKT hiện có.");
      const shiftBackup: Record<string, ImportShiftEntry[]> = {};
      for (const day of importPackage.days) {
        const response = await fetch(`/api/shift-readings?date=${encodeURIComponent(day.date)}`, { cache: "no-store" });
        const body = (await response.json()) as { entries?: ImportShiftEntry[]; error?: string };
        if (!response.ok) throw new Error(body.error || `Không sao lưu được dữ liệu BCSX ngày ${day.date}.`);
        shiftBackup[day.date] = body.entries || [];
      }
      backup = { report: reportBackup, shifts: shiftBackup, importedDays: importPackage.days };
      const backupBlob = new Blob([JSON.stringify({ createdAt: new Date().toISOString(), ...backup }, null, 2)], { type: "application/json" });
      const backupUrl = URL.createObjectURL(backupBlob);
      const backupLink = document.createElement("a");
      backupLink.href = backupUrl;
      backupLink.download = `CTKTKT_BACKUP_${importPackage.month}.json`;
      backupLink.click();
      URL.revokeObjectURL(backupUrl);

      for (const day of importPackage.days) {
        // Mark the day before the first mutation. If the manual write succeeds
        // but the BCSX write fails, the catch block must restore both stores.
        completed.push(day);
        await postJson("/api/ctktkt-report", { operatingDate: day.date, entries: day.manualEntries });
        await postJson("/api/shift-readings", { date: day.date, entries: day.shiftEntries });
      }

      const verifyResponse = await fetch(`/api/ctktkt-report?period=${encodeURIComponent(importPackage.month)}`, { cache: "no-store" });
      const verified = (await verifyResponse.json()) as { entries?: LoadedEntry[]; linkedEntries?: LoadedEntry[]; warnings?: LinkWarning[]; error?: string };
      if (!verifyResponse.ok) throw new Error(verified.error || "Không đọc lại được dữ liệu sau khi nhập.");
      const actual = new Map([...(verified.entries || []), ...(verified.linkedEntries || [])].map(entry => [`${entry.operatingDate}|${entry.cell}`, entry.value]));
      const sameValue = (left: string | undefined, right: string) => {
        if (!right) return left === undefined || left === "";
        const a = Number(left), b = Number(right);
        return Number.isFinite(a) && Number.isFinite(b) ? Math.abs(a - b) <= 1e-9 : left === right;
      };
      for (const day of importPackage.days) {
        for (const entry of day.manualEntries) {
          if (!sameValue(actual.get(`${day.date}|${entry.cell}`), entry.value)) throw new Error(`Đọc lại không khớp ô ${entry.cell}, ngày ${day.date}.`);
        }
        for (const link of CTKTKT_BCSX_LINKS) {
          const sourceUnit = link.unit === "S1/S2" ? "S1" : link.unit;
          const expected = day.shiftEntries.find(entry => entry.unit === sourceUnit && entry.timeSlot === link.timeSlot && entry.metric === link.metric)?.value || "";
          if (!sameValue(actual.get(`${day.date}|${link.cell}`), expected)) throw new Error(`Đọc lại không khớp ô liên kết ${link.cell}, ngày ${day.date}.`);
        }
      }

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
      setDate(`${importPackage.month}-${String(importPackage.throughDay).padStart(2, "0")}`);
      setDirty(false);
      setMessage(`Đã nhập và đọc lại xác nhận ${importPackage.days.length} ngày; ${importPackage.totals.passed}/${importPackage.totals.checks} phép đối chiếu công thức đạt.`);
    } catch (reason) {
      let rollbackMessage = "";
      if (backup && completed.length) {
        try {
          const oldByDate = new Map<string, Record<string, string>>();
          for (const entry of backup.report.entries || []) {
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
            const oldShifts = new Map((backup.shifts[day.date] || []).map(entry => [`${entry.unit}|${entry.timeSlot}|${entry.metric}`, entry.value]));
            await postJson("/api/shift-readings", {
              date: day.date,
              entries: day.shiftEntries.map(entry => ({ ...entry, value: oldShifts.get(`${entry.unit}|${entry.timeSlot}|${entry.metric}`) || "" })),
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
    },
  ) => {
    const isLinked = CTKTKT_BCSX_LINKED_CELLS.has(cell);
    const canEditThis = !isLinked && canEditCtktktField(user, cell);
    const value = current[cell] || "";

    const groupMeta = options?.group ? CTKTKT_GROUP_META[options.group] : null;
    const tooltip = isLinked
      ? `${cell}: Liên kết tự động từ BCSX mục 1`
      : canEditThis
        ? `${cell}: Bạn có quyền nhập liệu (Phím mũi tên để chuyển ô, Ctrl+V để dán nhiều ô)`
        : `${cell}: Khóa (Chỉ ${groupMeta?.responsible || "cương vị được phân công"} nhập)`;

    return (
      <div className="relative flex items-center justify-center">
        <input
          data-cell={cell}
          data-editable={canEditThis ? "true" : "false"}
          disabled={!canEditThis || loading}
          inputMode={options?.isNumber === false ? "text" : "decimal"}
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
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
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
              <span>Ngày:</span>
              <DateField
                value={date}
                onChange={value => {
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
              onClick={handleSeedSample}
              disabled={seeding || loading}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/90 px-3.5 text-xs font-bold text-indigo-700 shadow-xs transition-all hover:bg-indigo-100 disabled:opacity-50"
              title="Nạp dữ liệu thực tế 2 ngày (16 & 17/09/2026) từ file gốc để thử nghiệm và kiểm tra xuất file"
            >
              <Database className="size-3.5" />
              {seeding ? "Đang nạp…" : "Nạp 2 ngày mẫu (16 & 17/09)"}
            </button>

            <input
              ref={importFileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={event => void handleHistoryImport(event.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => importFileRef.current?.click()}
              disabled={!userCanEditAny || importingHistory || loading}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 text-xs font-bold text-amber-800 shadow-xs transition-all hover:bg-amber-100 disabled:opacity-45"
              title="Nhập gói dữ liệu lịch sử đã đối chiếu 100% với file Excel; hệ thống tự tải bản sao lưu trước khi ghi"
            >
              <Upload className="size-3.5" />
              {importingHistory ? "Đang nhập lịch sử…" : "Nhập dữ liệu Excel đã kiểm tra"}
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
            className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-800"
          >
            {item.message}
          </p>
        ))}
        {error && (
          <p
            role="alert"
            className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-800"
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
              (Công thức khóa tự tính · Nhập I35, I36)
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
                    <th className="p-2 text-left font-bold">Chỉ tiêu KTKT</th>
                    <th className="p-2 text-right font-bold">Tổ máy S1</th>
                    <th className="p-2 text-right font-bold">Tổ máy S2</th>
                    <th className="p-2 text-right font-bold">Toàn Nhà máy</th>
                    <th className="p-2 text-center font-bold">Đơn vị</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metricRows.map(row => (
                    <tr key={row.key} className="hover:bg-slate-50/70">
                      <td className="p-2 font-medium text-slate-800">{row.label}</td>
                      <td className="bg-cyan-50/30 p-2 text-right font-bold font-mono tabular-nums text-[#173b64]">
                        {format(summary.s1[row.key])}
                      </td>
                      <td className="bg-cyan-50/30 p-2 text-right font-bold font-mono tabular-nums text-[#173b64]">
                        {format(summary.s2[row.key])}
                      </td>
                      <td className="bg-blue-50/40 p-2 text-right font-black font-mono tabular-nums text-indigo-900">
                        {format(summary.plant[row.key])}
                      </td>
                      <td className="p-2 text-center font-medium text-slate-500">{row.unit}</td>
                    </tr>
                  ))}
                  {/* Hai ô nhập tay duy nhất của Cụm 1 */}
                  <tr className="bg-amber-50/30 border-t-2 border-amber-200">
                    <td className="p-2 font-bold text-amber-950">
                      Suất hao bi nghiền than (Ô I35)
                    </td>
                    <td colSpan={2} className="p-2 text-xs text-slate-500 italic">
                      Mặc định 150 g/tấn than (Trưởng kíp điện / Thống kê nhập)
                    </td>
                    <td className="p-1.5 text-right w-36">
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
                    <td colSpan={2} className="p-2 text-xs text-slate-500 italic">
                      Cộng dồn vào lượng than tồn kho ngày D
                    </td>
                    <td className="p-1.5 text-right w-36">
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
        <div className="flex flex-wrap items-center gap-1.5 border-b bg-[#f8fafc] p-2.5">
          <button
            type="button"
            onClick={() => setActiveTab("tkd_dcs")}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              activeTab === "tkd_dcs"
                ? "bg-[#4057b5] text-white shadow-xs"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Zap className="size-3.5" />
            <span>Cụm 2: TKĐ Trend DCS</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                activeTab === "tkd_dcs" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              Trưởng kíp điện
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("unit_meters")}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              activeTab === "unit_meters"
                ? "bg-[#4057b5] text-white shadow-xs"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Power className="size-3.5" />
            <span>Cụm 4 & 5: Công tơ S1 & S2</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                activeTab === "unit_meters"
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              TPD · Lò phó · Máy nghiền
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("steam_nh3")}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              activeTab === "steam_nh3"
                ? "bg-[#4057b5] text-white shadow-xs"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Droplets className="size-3.5" />
            <span>Cụm 6 & 8: Hơi & Bồn NH3</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                activeTab === "steam_nh3"
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              TKĐ · VHV NH3
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("td21_coal_blend")}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              activeTab === "td21_coal_blend"
                ? "bg-[#4057b5] text-white shadow-xs"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Boxes className="size-3.5" />
            <span>Cụm 9 & 14: TD21 & Than trộn PMIS</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                activeTab === "td21_coal_blend"
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              TPD · TKĐ
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("startup_shutdown")}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              activeTab === "startup_shutdown"
                ? "bg-amber-700 text-white shadow-xs"
                : "border border-amber-200 bg-amber-50/60 text-amber-900 hover:bg-amber-100/70"
            }`}
          >
            <Flame className="size-3.5" />
            <span>Cụm 11: KĐ / Ngừng tổ máy</span>
            <span className="rounded-full bg-amber-200 px-1.5 py-0.2 text-[10px] font-bold text-amber-900">
              Sự kiện
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("pmis_reports")}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              activeTab === "pmis_reports"
                ? "bg-slate-800 text-white shadow-xs"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <FileText className="size-3.5" />
            <span>Báo cáo PMIS 02-PĐ</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                activeTab === "pmis_reports" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
              }`}
            >
              PMIS &amp; QLKT
            </span>
          </button>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("all_fields")}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                activeTab === "all_fields"
                  ? "bg-slate-700 text-white shadow-xs"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Search className="size-3.5" />
              <span>Tra cứu ô ({editableFields.length})</span>
            </button>
          </div>
        </div>

        {/* NỘI DUNG TỪNG CỤM */}
        <div className="p-4">
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
                            <th className="p-1.5 text-center font-bold">08h (Ca 3)</th>
                            <th className="p-1.5 text-center font-bold">16h (Ca 1)</th>
                            <th className="p-1.5 text-center font-bold">24h (Ca 2)</th>
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
                            <th className="p-1.5 text-center font-bold">08h (Ca 3)</th>
                            <th className="p-1.5 text-center font-bold">16h (Ca 1)</th>
                            <th className="p-1.5 text-center font-bold">24h (Ca 2)</th>
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
                      Cụm 14: Bảng nhập PMIS đốt than trộn 6A10 và Sub bitum
                    </h3>
                    <p className="text-xs text-slate-500">
                      Trưởng kíp điện nhập theo 3 ca (0h-08h, 08h-16h, 16h-24h): Độ ẩm Wtp (%),
                      Nhiệt trị khô Qk (kcal/kg) của S1 & S2 và Tỷ lệ trộn than.
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
                        <th className="p-2 text-left font-bold w-48">Tổ máy / Thông số</th>
                        <th className="p-2 text-center font-bold">Ca 3 (0h - 08h)</th>
                        <th className="p-2 text-center font-bold">Ca 1 (08h - 16h)</th>
                        <th className="p-2 text-center font-bold">Ca 2 (16h - 24h)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {/* S1 Độ ẩm */}
                      <tr>
                        <td className="p-2 font-bold text-slate-800 font-sans">
                          S1: Ẩm toàn phần Wtp (%)
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("AJ87", { group: "coal_blend_pmis" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("AJ88", { group: "coal_blend_pmis" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("AJ89", { group: "coal_blend_pmis" })}
                        </td>
                      </tr>
                      {/* S1 Nhiệt trị */}
                      <tr>
                        <td className="p-2 font-bold text-slate-800 font-sans">
                          S1: Nhiệt trị khô Qk (kcal/kg)
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("AK87", { group: "coal_blend_pmis" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("AK88", { group: "coal_blend_pmis" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("AK89", { group: "coal_blend_pmis" })}
                        </td>
                      </tr>

                      {/* S2 Độ ẩm */}
                      <tr className="bg-slate-50/50">
                        <td className="p-2 font-bold text-slate-800 font-sans">
                          S2: Ẩm toàn phần Wtp (%)
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("AJ90", { group: "coal_blend_pmis" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("AJ91", { group: "coal_blend_pmis" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("AJ92", { group: "coal_blend_pmis" })}
                        </td>
                      </tr>
                      {/* S2 Nhiệt trị */}
                      <tr className="bg-slate-50/50">
                        <td className="p-2 font-bold text-slate-800 font-sans">
                          S2: Nhiệt trị khô Qk (kcal/kg)
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("AK90", { group: "coal_blend_pmis" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("AK91", { group: "coal_blend_pmis" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("AK92", { group: "coal_blend_pmis" })}
                        </td>
                      </tr>

                      <tr className="bg-amber-50/40">
                        <td className="p-2 font-bold text-amber-950 font-sans">
                          S1: Tỷ lệ trộn Sub bitum (0–1; 20% nhập 0,20)
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("AL87", { group: "coal_blend_pmis" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("AL88", { group: "coal_blend_pmis" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("AL89", { group: "coal_blend_pmis" })}
                        </td>
                      </tr>
                      <tr className="bg-amber-50/40">
                        <td className="p-2 font-bold text-amber-950 font-sans">
                          S2: Tỷ lệ trộn Sub bitum (0–1; 20% nhập 0,20)
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("AL90", { group: "coal_blend_pmis" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("AL91", { group: "coal_blend_pmis" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("AL92", { group: "coal_blend_pmis" })}
                        </td>
                      </tr>
                      <tr className="bg-orange-50/40">
                        <td className="p-2 font-bold text-orange-950 font-sans">
                          S1: Độ ẩm than Sub bitum (%)
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("AO87", { group: "coal_blend_pmis" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("AO88", { group: "coal_blend_pmis" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("AO89", { group: "coal_blend_pmis" })}
                        </td>
                      </tr>
                      <tr className="bg-orange-50/40">
                        <td className="p-2 font-bold text-orange-950 font-sans">
                          S2: Độ ẩm than Sub bitum (%)
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("AO90", { group: "coal_blend_pmis" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("AO91", { group: "coal_blend_pmis" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("AO92", { group: "coal_blend_pmis" })}
                        </td>
                      </tr>
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
                      Cụm 11: Bảng công tơ dầu khi Khởi động / Ngừng tổ máy
                    </h3>
                    <p className="text-xs text-amber-900">
                      Chỉ nhập khi có sự kiện khởi động hoặc ngừng tổ máy (Dầu cấp lò S2 & Lò hơi
                      phụ).
                    </p>
                  </div>
                  <span className="rounded-md bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-900">
                    Trưởng ca · Trưởng kíp điện · Lò phó
                  </span>
                </div>

                <div className="overflow-x-auto rounded-lg border bg-white">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#fef9f0] text-amber-950">
                        <th className="p-2 text-left font-bold w-64">Chỉ số công tơ dầu</th>
                        <th className="p-2 text-center font-bold">Khởi động</th>
                        <th className="p-2 text-center font-bold">Hòa lưới I</th>
                        <th className="p-2 text-center font-bold">Tách lưới I</th>
                        <th className="p-2 text-center font-bold">Hòa lưới II</th>
                        <th className="p-2 text-center font-bold">Tách lưới II</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      <tr>
                        <td className="p-2 font-bold text-slate-800 font-sans">
                          Công tơ dầu cấp lò S2
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("C87", { group: "startup_shutdown" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("D87", { group: "startup_shutdown" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("E87", { group: "startup_shutdown" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("F87", { group: "startup_shutdown" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("G87", { group: "startup_shutdown" })}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-slate-800 font-sans">
                          Công tơ dầu về lò S2
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("C88", { group: "startup_shutdown" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("D88", { group: "startup_shutdown" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("E88", { group: "startup_shutdown" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("F88", { group: "startup_shutdown" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("G88", { group: "startup_shutdown" })}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-slate-800 font-sans">
                          Công tơ cấp dầu lên lò hơi phụ
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("C93", { group: "startup_shutdown" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("D93", { group: "startup_shutdown" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("E93", { group: "startup_shutdown" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("F93", { group: "startup_shutdown" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("G93", { group: "startup_shutdown" })}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-slate-800 font-sans">
                          Công tơ cấp dầu về lò hơi phụ
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("C94", { group: "startup_shutdown" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("D94", { group: "startup_shutdown" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("E94", { group: "startup_shutdown" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("F94", { group: "startup_shutdown" })}
                        </td>
                        <td className="p-1.5 text-center">
                          {renderCellInput("G94", { group: "startup_shutdown" })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
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
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${extensionVersion ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${extensionVersion ? "bg-emerald-500" : "bg-amber-500"}`} />
                        {extensionVersion ? `Tiện ích v${extensionVersion}` : "Chưa kết nối tiện ích"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Đồng bộ tự động từ QLKT (mục Sản lượng DH1_MF1/MF2 và mục 02-PĐ hàng Duyên Hải 1) hoặc nhập trực tiếp. Các số liệu này tự động liên kết sang Mục 2 của Báo cáo sản xuất (BCSX S1, S2, A0).
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={syncingPmis || !canEditPmis}
                      onClick={syncPmis02PdFromQlkt}
                      title={!canEditPmis ? "Tài khoản chưa được cấp quyền nhập nhóm Báo cáo PMIS." : "Đồng bộ Sản lượng (DH1_MF1/MF2) và 18 chỉ tiêu 02-PĐ (hàng Duyên Hải 1) từ QLKT"}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#173b64] to-[#2563eb] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Zap className="size-3.5" />
                      {syncingPmis ? "Đang đồng bộ từ QLKT…" : "⚡ Đồng bộ PMIS & 02-PĐ từ QLKT"}
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
                      💡 <b>Liên kết trực tiếp:</b> Số liệu Điện đầu cực (J157, J158) và Xuất tuyến (K157, K158) ở đây tự động làm nguồn cho <b>Mục 2 của Báo cáo sản xuất (BCSX)</b> cho cả 3 file S1, S2, A0.
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
