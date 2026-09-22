"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { DateField } from "@/components/ui/date-field";
import { EVENT_TYPES, SHIFT_METRICS, SHIFT_TIME_SLOTS, type OperatingEvent, type ShiftMetric } from "@/lib/bcsx";
import { useSessionUser } from "@/components/session-context";
import { hasPermission } from "@/lib/auth/session";
import { defaultOperatingDate } from "@/lib/operating-date";

type Unit = "S1" | "S2";
type ReadingsGrid = Record<ShiftMetric, string[]>;
type Section1ImportEntry = { unit: Unit; timeSlot: string; metric: ShiftMetric; value: string };
type Section1ImportDay = { date: string; entries: Section1ImportEntry[] };
type Section1ImportPackage = {
  kind: "BCSX_SECTION_1_HISTORY";
  version: 1;
  month: string;
  throughDay: number;
  totals: { days: number; entries: number; checks: number; passed: number; failed: number };
  days: Section1ImportDay[];
};

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

function parseAndScaleMwh(valStr: string | undefined): string {
  if (!valStr || !valStr.trim()) return "";
  const clean = valStr.trim().replace(",", ".");
  const num = Number(clean);
  if (!Number.isFinite(num)) return valStr;
  // Trong daily_inputs lưu đơn vị triệu kWh (ví dụ 10.47). Nếu < 100 thì quy đổi sang MWh (* 1000)
  if (num > 0 && num < 100) {
    const mwh = num * 1000;
    return String(Number(mwh.toFixed(2)));
  }
  return String(num);
}

function scaleDownToMillionKwh(valStr: string): string {
  if (!valStr || !valStr.trim()) return "";
  const clean = valStr.trim().replace(",", ".");
  const num = Number(clean);
  if (!Number.isFinite(num)) return valStr;
  // Nếu người dùng nhập đơn vị MWh (>= 100, ví dụ 10470), quy đổi về triệu kWh (/ 1000) khi lưu daily_inputs
  if (num >= 100) {
    const mil = num / 1000;
    return String(Number(mil.toFixed(6)));
  }
  return String(num);
}

export function BcsxReport() {
  const user = useSessionUser();
  const isViewer = !hasPermission(user, "edit_bcsx");
  const [operatingDate, setOperatingDate] = useState(defaultOperatingDate);
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
  const [importingSection1, setImportingSection1] = useState(false);
  const [importingOperations, setImportingOperations] = useState(false);
  const section1ImportRef = useRef<HTMLInputElement | null>(null);
  const operationImportRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const [readingsRes, eventsRes, totalsRes, ctktktRes] = [
          await fetch(`/api/shift-readings?date=${operatingDate}`),
          await fetch(`/api/operating-events?date=${operatingDate}`),
          await fetch(`/api/daily-inputs?period=${operatingDate.slice(0, 7)}`),
          await fetch(`/api/ctktkt-report?period=${operatingDate.slice(0, 7)}`),
        ];
        const readingsJson = await readingsRes.json() as { entries?: { unit: Unit; timeSlot: string; metric: ShiftMetric; value: string }[]; error?: string };
        const eventsJson = await eventsRes.json() as { events?: (OperatingEvent & { unit: Unit })[]; error?: string };
        const totalsJson = await totalsRes.json() as { entries?: { operatingDate: string; fieldCode: string; value: string }[]; error?: string };
        const ctktktJson = await ctktktRes.json() as { entries?: { operatingDate: string; cell: string; value: string }[]; error?: string };
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
        const ktktByCell = new Map((ctktktJson.entries || []).filter(e => e.operatingDate === operatingDate).map(e => [e.cell, e.value]));

        // Mục 2 của BCSX lấy nguồn từ file Chỉ tiêu KTKT (J157/K157 cho S1, J158/K158 cho S2, Than tiêu thụ & Tồn kho)
        const ktktJ157 = ktktByCell.get("J157");
        const ktktK157 = ktktByCell.get("K157");
        const ktktJ158 = ktktByCell.get("J158");
        const ktktK158 = ktktByCell.get("K158");
        const ktktN169 = ktktByCell.get("N169");
        const ktktN171 = ktktByCell.get("N171");
        const ktktAR = ktktByCell.get("I38") || ktktByCell.get("B38");

        setTotals({
          S1: {
            dauCuc: ktktJ157 || parseAndScaleMwh(byCode.get("B")),
            thuongPham: ktktK157 || parseAndScaleMwh(byCode.get("C")),
            thanTieuThu: ktktN169 || byCode.get("AE") || "",
            thanTonKho: ktktAR || byCode.get("AR") || "",
          },
          S2: {
            dauCuc: ktktJ158 || parseAndScaleMwh(byCode.get("H")),
            thuongPham: ktktK158 || parseAndScaleMwh(byCode.get("I")),
            thanTieuThu: ktktN171 || byCode.get("AF") || "",
            thanTonKho: ktktAR || byCode.get("AR") || "",
          },
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

  function changeOperatingDate(nextDate: string) {
    setOperatingDate(nextDate);
  }

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

  async function importSection1History(files: FileList | null) {
    if (!files || isViewer) return;
    setImportingSection1(true); setError(null); setNotice(null);
    const completed: Section1ImportDay[] = [];
    let backup: Record<string, Section1ImportEntry[]> | null = null;

    const postDay = async (day: Section1ImportDay) => {
      const response = await fetch("/api/shift-readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: day.date, entries: day.entries }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok || body.error) throw new Error(body.error || `Không ghi được Mục 1 ngày ${day.date}.`);
    };

    try {
      if (files.length !== 2) throw new Error("Hãy chọn đồng thời đúng 2 file Excel BCSX: một file S1 và một file S2.");
      const formData = new FormData();
      Array.from(files).forEach(file => formData.append("files", file));
      const parseResponse = await fetch("/api/bcsx-section1-import", { method: "POST", body: formData });
      const rawParseResponse = await parseResponse.text();
      let parsed: Partial<Section1ImportPackage> & { error?: string };
      try {
        parsed = JSON.parse(rawParseResponse) as Partial<Section1ImportPackage> & { error?: string };
      } catch {
        throw new Error("Máy chủ không trả dữ liệu JSON hợp lệ khi đọc hai file Excel S1/S2.");
      }
      if (!parseResponse.ok || parsed.error) throw new Error(parsed.error || "Không đọc được hai file Excel S1/S2.");
      if (parsed.kind !== "BCSX_SECTION_1_HISTORY" || parsed.version !== 1 || !/^\d{4}-\d{2}$/.test(parsed.month || "") || !Number.isInteger(parsed.throughDay) || Number(parsed.throughDay) < 1 || Number(parsed.throughDay) > 31 || !Array.isArray(parsed.days) || parsed.days.length !== parsed.throughDay) {
        throw new Error("Gói nhập Mục 1 BCSX không đúng cấu trúc.");
      }
      if (!parsed.totals || parsed.totals.failed !== 0 || parsed.totals.checks !== parsed.totals.passed) {
        throw new Error("Gói nhập chưa đạt kiểm tra đầy đủ; chưa ghi dữ liệu.");
      }
      const importPackage = parsed as Section1ImportPackage;
      const expectedKeys = new Set((['S1', 'S2'] as const).flatMap(importUnit => SHIFT_TIME_SLOTS.flatMap(timeSlot => SHIFT_METRICS.map(metric => `${importUnit}|${timeSlot}|${metric.key}`))));
      const seenDates = new Set<string>();
      for (const [dayIndex, day] of importPackage.days.entries()) {
        const expectedDate = `${importPackage.month}-${String(dayIndex + 1).padStart(2, "0")}`;
        if (day.date !== expectedDate || seenDates.has(day.date) || !Array.isArray(day.entries) || day.entries.length !== expectedKeys.size) {
          throw new Error(`Dữ liệu ngày ${day.date || "không rõ"} không hợp lệ.`);
        }
        seenDates.add(day.date);
        const keys = new Set<string>();
        for (const entry of day.entries) {
          const key = `${entry.unit}|${entry.timeSlot}|${entry.metric}`;
          if (!expectedKeys.has(key) || keys.has(key) || !String(entry.value).trim() || !Number.isFinite(Number(entry.value))) {
            throw new Error(`Mục 1 ngày ${day.date} có ô thiếu, trùng hoặc không phải số.`);
          }
          keys.add(key);
        }
      }
      if (importPackage.totals.days !== importPackage.days.length || importPackage.totals.entries !== importPackage.days.length * expectedKeys.size || importPackage.totals.checks !== importPackage.totals.entries || importPackage.totals.passed !== importPackage.totals.entries) {
        throw new Error("Tổng kiểm tra trong gói nhập không khớp dữ liệu chi tiết.");
      }

      backup = {};
      for (const day of importPackage.days) {
        const response = await fetch(`/api/shift-readings?date=${encodeURIComponent(day.date)}`, { cache: "no-store" });
        const body = await response.json() as { entries?: Section1ImportEntry[]; error?: string };
        if (!response.ok || body.error) throw new Error(body.error || `Không sao lưu được ngày ${day.date}.`);
        backup[day.date] = body.entries || [];
      }
      const backupBlob = new Blob([JSON.stringify({ kind: "BCSX_SECTION_1_BACKUP", createdAt: new Date().toISOString(), entriesByDate: backup }, null, 2)], { type: "application/json" });
      const backupUrl = URL.createObjectURL(backupBlob);
      const backupLink = document.createElement("a");
      backupLink.href = backupUrl;
      backupLink.download = `BCSX_SECTION1_BACKUP_${importPackage.month}.json`;
      backupLink.click();
      URL.revokeObjectURL(backupUrl);

      for (const day of importPackage.days) {
        completed.push(day);
        await postDay(day);
      }

      for (const day of importPackage.days) {
        const response = await fetch(`/api/shift-readings?date=${encodeURIComponent(day.date)}`, { cache: "no-store" });
        const body = await response.json() as { entries?: Section1ImportEntry[]; error?: string };
        if (!response.ok || body.error) throw new Error(body.error || `Không đọc lại được ngày ${day.date}.`);
        const actual = new Map((body.entries || []).map(entry => [`${entry.unit}|${entry.timeSlot}|${entry.metric}`, entry.value]));
        for (const entry of day.entries) {
          const saved = actual.get(`${entry.unit}|${entry.timeSlot}|${entry.metric}`);
          if (saved === undefined || Math.abs(Number(saved) - Number(entry.value)) > 1e-9) throw new Error(`Đọc lại không khớp ${entry.unit} ${entry.timeSlot} ${entry.metric}, ngày ${day.date}.`);
        }
      }

      const lastDay = importPackage.days[importPackage.days.length - 1];
      const nextGrids: Record<Unit, ReadingsGrid> = { S1: emptyGrid(), S2: emptyGrid() };
      const slotIndex = new Map(SHIFT_TIME_SLOTS.map((slot, index) => [slot, index]));
      for (const entry of lastDay.entries) {
        const index = slotIndex.get(entry.timeSlot);
        if (index !== undefined) nextGrids[entry.unit][entry.metric][index] = entry.value;
      }
      setGrids(nextGrids);
      setOperatingDate(lastDay.date);
      setNotice(`Đã nhập và đọc lại xác nhận ${importPackage.totals.entries.toLocaleString("vi-VN")} giá trị Mục 1 cho ${importPackage.days.length} ngày. Mục 2 và nhật ký sự kiện không thay đổi.`);
    } catch (caught) {
      let rollbackMessage = "";
      if (backup && completed.length) {
        try {
          for (const day of [...completed].reverse()) {
            const previous = new Map((backup[day.date] || []).map(entry => [`${entry.unit}|${entry.timeSlot}|${entry.metric}`, entry.value]));
            await postDay({
              date: day.date,
              entries: day.entries.map(entry => ({ ...entry, value: previous.get(`${entry.unit}|${entry.timeSlot}|${entry.metric}`) || "" })),
            });
          }
          rollbackMessage = " Đã hoàn nguyên các ngày đã bắt đầu ghi.";
        } catch {
          rollbackMessage = " Hoàn nguyên tự động không trọn vẹn; dùng file BCSX_SECTION1_BACKUP vừa tải để phục hồi.";
        }
      }
      setError(`${caught instanceof Error ? caught.message : "Không nhập được lịch sử Mục 1."}${rollbackMessage}`);
    } finally {
      setImportingSection1(false);
      if (section1ImportRef.current) section1ImportRef.current.value = "";
    }
  }

  async function importOperationCommands(files: FileList | null) {
    if (!files || isViewer) return;
    setImportingOperations(true); setError(null); setNotice(null);
    try {
      if (files.length !== 1) throw new Error("Hãy chọn đúng 1 file DanhSachLenhKetThuc dạng .xlsx.");
      const formData = new FormData();
      formData.append("file", files[0]);
      formData.append("date", operatingDate);
      const response = await fetch("/api/bcsx-operation-import", { method: "POST", body: formData });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error || "Không nhập được file lệnh điều độ.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] || "DH1_Thoi_gian_VH.xlsx";
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);

      const eventsResponse = await fetch("/api/operating-events?date=" + encodeURIComponent(operatingDate), { cache: "no-store" });
      const eventsBody = await eventsResponse.json() as { events?: (OperatingEvent & { unit: Unit })[]; error?: string };
      if (!eventsResponse.ok || eventsBody.error) throw new Error(eventsBody.error || "Đã lưu và tải file QLKT nhưng không tải lại được Mục 3.");
      const nextEvents: Record<Unit, OperatingEvent[]> = { S1: [], S2: [] };
      for (const event of eventsBody.events || []) nextEvents[event.unit]?.push(event);
      setEvents(nextEvents);

      const s1Count = Number(response.headers.get("X-BCSX-S1-Events") || nextEvents.S1.length);
      const s2Count = Number(response.headers.get("X-BCSX-S2-Events") || nextEvents.S2.length);
      const ignoredRows = Number(response.headers.get("X-BCSX-Ignored-Rows") || 0);
      setNotice("Đã tự lưu Mục 3: S1 (" + s1Count + " sự kiện), S2 (" + s2Count + " sự kiện) và tải file QLKT " + fileName + (ignoredRows ? ". Bỏ qua " + ignoredRows + " dòng không thuộc lệnh thay đổi công suất hoàn thành." : "."));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không nhập được file lệnh điều độ.");
    } finally {
      setImportingOperations(false);
      if (operationImportRef.current) operationImportRef.current.value = "";
    }
  }

  function setTotal(field: keyof TotalsDraft, value: string) {
    setTotals(old => ({ ...old, [unit]: { ...old[unit], [field]: value } }));
  }

  async function reloadTotalsFromCtktkt() {
    setError(null); setNotice(null);
    try {
      const period = operatingDate.slice(0, 7);
      const [totalsRes, ctktktRes] = await Promise.all([
        fetch(`/api/daily-inputs?period=${period}`),
        fetch(`/api/ctktkt-report?period=${period}`),
      ]);
      const totalsJson = await totalsRes.json() as { entries?: { operatingDate: string; fieldCode: string; value: string }[] };
      const ctktktJson = await ctktktRes.json() as { entries?: { operatingDate: string; cell: string; value: string }[] };
      const byCode = new Map((totalsJson.entries || []).filter(e => e.operatingDate === operatingDate).map(e => [e.fieldCode, e.value]));
      const ktktByCell = new Map((ctktktJson.entries || []).filter(e => e.operatingDate === operatingDate).map(e => [e.cell, e.value]));

      const ktktJ157 = ktktByCell.get("J157");
      const ktktK157 = ktktByCell.get("K157");
      const ktktJ158 = ktktByCell.get("J158");
      const ktktK158 = ktktByCell.get("K158");
      const ktktN169 = ktktByCell.get("N169");
      const ktktN171 = ktktByCell.get("N171");
      const ktktAR = ktktByCell.get("I38") || ktktByCell.get("B38");

      setTotals({
        S1: {
          dauCuc: ktktJ157 || parseAndScaleMwh(byCode.get("B")),
          thuongPham: ktktK157 || parseAndScaleMwh(byCode.get("C")),
          thanTieuThu: ktktN169 || byCode.get("AE") || "",
          thanTonKho: ktktAR || byCode.get("AR") || "",
        },
        S2: {
          dauCuc: ktktJ158 || parseAndScaleMwh(byCode.get("H")),
          thuongPham: ktktK158 || parseAndScaleMwh(byCode.get("I")),
          thanTieuThu: ktktN171 || byCode.get("AF") || "",
          thanTonKho: ktktAR || byCode.get("AR") || "",
        },
      });
      setNotice(`Đã nạp lại 4 số liệu Mục 2 từ Chỉ tiêu KTKT cho ngày ${operatingDate.split("-").reverse().join("/")}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải lại được số liệu từ Chỉ tiêu KTKT.");
    }
  }

  async function saveTotals() {
    setSaving(true); setError(null); setNotice(null);
    try {
      const codes = TOTAL_FIELD_CODES[unit];
      const t = totals[unit];
      const entries = [
        { operatingDate, fieldCode: codes.dauCuc, value: scaleDownToMillionKwh(t.dauCuc.trim()) },
        { operatingDate, fieldCode: codes.thuongPham, value: scaleDownToMillionKwh(t.thuongPham.trim()) },
        { operatingDate, fieldCode: codes.thanTieuThu, value: t.thanTieuThu.trim() },
        { operatingDate, fieldCode: codes.thanTonKho, value: t.thanTonKho.trim() },
      ];
      const res = await fetch("/api/daily-inputs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ period: operatingDate.slice(0, 7), entries }) });
      const json = await res.json() as { saved?: number; error?: string };
      if (!res.ok || json.error) throw new Error(json.error || "Không lưu được số liệu tổng ngày.");

      // Đồng bộ đồng thời sang Chỉ tiêu KTKT (J157/K157 cho S1, J158/K158 cho S2)
      try {
        const ktktEntries = unit === "S1"
          ? [{ cell: "J157", value: t.dauCuc.trim() }, { cell: "K157", value: t.thuongPham.trim() }]
          : [{ cell: "J158", value: t.dauCuc.trim() }, { cell: "K158", value: t.thuongPham.trim() }];
        await fetch("/api/ctktkt-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operatingDate, entries: ktktEntries }),
        });
      } catch {
        // Bỏ qua nếu người dùng không thuộc nhóm phân quyền chỉ tiêu
      }

      setNotice(`Đã lưu số liệu tổng ngày tổ máy ${unit} (đồng bộ sang Chỉ tiêu KTKT & Dữ liệu các tháng).`);
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
    { id: "ca3", label: "Ca 3", hours: "16:30 – 23:59", start: 32, end: 48, headerColor: "bg-[#fef3d6] text-[#854d0e] border-amber-200" },
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
          <DateField value={operatingDate} onChange={changeOperatingDate} className="w-[145px] h-8 text-xs"/>
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

          <input
            ref={section1ImportRef}
            type="file"
            accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx"
            multiple
            className="hidden"
            onChange={event => void importSection1History(event.target.files)}
          />
          <button
            type="button"
            onClick={() => section1ImportRef.current?.click()}
            disabled={importingSection1 || saving || isViewer}
            className="h-7 rounded-lg border border-amber-300 bg-amber-50 px-2.5 text-xs font-bold text-amber-800 shadow-sm hover:bg-amber-100 disabled:opacity-50"
            title="Chọn đồng thời đúng 2 file Excel BCSX S1 và S2; hệ thống tự kiểm tra, sao lưu và đọc lại sau khi ghi"
          >
            {importingSection1 ? "Đang nhập 2 file…" : "Chọn 2 file S1 & S2"}
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
            {renderShiftTable(32, 48, "Ca 3", "16:30 – 23:59", "bg-[#fef3d6] text-[#854d0e]")}
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-extrabold text-[#173b64]">2. Số liệu tổng ngày — tổ máy {unit}</h2>
          <p className="mt-0.5 text-xs text-slate-500">4 số liệu được liên kết trực tiếp từ trang <Link href="/ctktkt-report" className="font-semibold text-[#334785] underline">Chỉ tiêu KTKT</Link> (Sản lượng đầu cực J157/J158 &amp; thương phẩm K157/K158 PMIS MWh, Than tiêu thụ &amp; tồn kho). Đã bỏ đồng bộ mục 2 này từ QLKT để tránh trùng lặp.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void reloadTotalsFromCtktkt()}
            className="rounded-lg border border-[#334785] bg-white px-3 py-1.5 text-xs font-bold text-[#334785] hover:bg-slate-50"
            title="Nạp lại số liệu Mục 2 mới nhất từ trang Chỉ tiêu KTKT"
          >
            🔄 Nạp lại từ Chỉ tiêu KTKT
          </button>
          <button
            type="button"
            disabled={saving || isViewer}
            title={isViewer ? "Tài khoản Chỉ xem không có quyền lưu dữ liệu." : undefined}
            onClick={() => void saveTotals()}
            className="rounded-lg bg-[#334785] px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {saving ? "Đang lưu…" : "Lưu số liệu tổng ngày"}
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="flex flex-col text-xs font-semibold text-slate-500">
          Sản lượng đầu cực (MWh)
          <input value={totals[unit].dauCuc} onChange={e => setTotal("dauCuc", e.target.value)} inputMode="decimal" placeholder="—" className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-right font-mono text-xs text-black outline-none focus:border-[#334785]"/>
        </label>
        <label className="flex flex-col text-xs font-semibold text-slate-500">
          Sản lượng thương phẩm (MWh)
          <input value={totals[unit].thuongPham} onChange={e => setTotal("thuongPham", e.target.value)} inputMode="decimal" placeholder="—" className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-right font-mono text-xs text-black outline-none focus:border-[#334785]"/>
        </label>
        <label className="flex flex-col text-xs font-semibold text-slate-500">
          Than tiêu thụ (tấn)
          <input value={totals[unit].thanTieuThu} onChange={e => setTotal("thanTieuThu", e.target.value)} inputMode="decimal" placeholder="—" className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-right font-mono text-xs text-black outline-none focus:border-[#334785]"/>
        </label>
        <label className="flex flex-col text-xs font-semibold text-slate-500">
          Than tồn kho (tấn, toàn nhà máy)
          <input value={totals[unit].thanTonKho} onChange={e => setTotal("thanTonKho", e.target.value)} inputMode="decimal" placeholder="—" className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-right font-mono text-xs text-black outline-none focus:border-[#334785]"/>
        </label>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">Sản lượng tự dùng = đầu cực − thương phẩm, tự tính khi xuất file, không cần nhập.</p>
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-extrabold text-[#173b64]">3. Tình hình vận hành (nhật ký sự kiện) — tổ máy {unit}</h2>
          <p className="mt-0.5 text-xs text-slate-500">Chọn file DanhSachLenhKetThuc: hệ thống tự nhận diện lệnh S1/S2, lưu ngay vào Mục 3 và tải file DH1 Thời gian vận hành để nhập lên QLKT. Có thể sửa tay sau khi nhập.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={operationImportRef}
            type="file"
            accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx"
            className="hidden"
            onChange={event => void importOperationCommands(event.target.files)}
          />
          <button
            type="button"
            disabled={importingOperations || saving || isViewer}
            title={isViewer ? "Tài khoản Chỉ xem không có quyền nhập dữ liệu." : "Chọn file DanhSachLenhKetThuc; hệ thống tự lưu S1/S2 và xuất file QLKT"}
            onClick={() => operationImportRef.current?.click()}
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
          >
            {importingOperations ? "Đang nhận diện và xuất…" : "Nhập file lệnh & xuất QLKT"}
          </button>
          <button
            type="button"
            disabled={saving || isViewer}
            title={isViewer ? "Tài khoản Chỉ xem không có quyền lưu dữ liệu." : undefined}
            onClick={() => void saveEvents()}
            className="rounded-lg bg-[#334785] px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {saving ? "Đang lưu…" : "Lưu nhật ký sự kiện"}
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs font-semibold text-slate-500">Bắt đầu<input type="time" value={draft.startTime} onChange={e => setDraft(d => ({ ...d, startTime: e.target.value }))} className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-black"/></label>
        <label className="flex flex-col text-xs font-semibold text-slate-500">Kết thúc<input type="time" value={draft.endTime} onChange={e => setDraft(d => ({ ...d, endTime: e.target.value }))} className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-black"/></label>
        <label className="flex flex-col text-xs font-semibold text-slate-500">Loại sự kiện<select value={draft.eventType} onChange={e => setDraft(d => ({ ...d, eventType: Number(e.target.value) }))} className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-black">{EVENT_TYPES.map(t => <option key={t.code} value={t.code}>{t.code} — {t.label}</option>)}</select></label>
        <label className="flex min-w-[220px] flex-1 flex-col text-xs font-semibold text-slate-500">Mô tả<input value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} placeholder="Ví dụ: Tăng tải S1 từ 435.7MW lên 536MW" className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-black"/></label>
        <button type="button" onClick={addEvent} className="rounded-lg border border-[#334785] px-3 py-1.5 text-xs font-bold text-[#334785] hover:bg-slate-50">+ Thêm dòng</button>
      </div>
      <div className="mt-3 overflow-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[560px] text-xs">
          <thead className="bg-[#dcebf5] text-[#173b64]">
            <tr>
              <th className="p-2 text-left w-[80px]">Bắt đầu</th>
              <th className="p-2 text-left w-[80px]">Kết thúc</th>
              <th className="p-2 text-center w-[60px]">Loại</th>
              <th className="p-2 text-left">Sự kiện</th>
              <th className="p-2 text-right w-[60px]"></th>
            </tr>
          </thead>
          <tbody>
            {unitEvents.map((e, i) => (
              <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="p-2 font-mono text-black font-semibold">{e.startAt.slice(11)}</td>
                <td className="p-2 font-mono text-black">{e.endAt ? e.endAt.slice(11) : "—"}</td>
                <td className="p-2 text-center text-black font-bold">{e.eventType}</td>
                <td className="p-2 text-black">{e.description}</td>
                <td className="p-2 text-right">
                  <button type="button" onClick={() => removeEvent(i)} className="text-xs font-bold text-red-500 hover:text-red-700">Xóa</button>
                </td>
              </tr>
            ))}
            {unitEvents.length === 0 && (
              <tr>
                <td colSpan={5} className="p-3 text-center text-slate-400 italic">
                  Chưa có sự kiện nào cho tổ máy {unit} trong ngày {operatingDate.split("-").reverse().join("/")}. Bấm &quot;Nhập file lệnh &amp; xuất QLKT&quot; hoặc thêm dòng thủ công.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex justify-end"><button type="button" disabled={saving || isViewer} title={isViewer ? "Tài khoản Chỉ xem không có quyền lưu dữ liệu." : undefined} onClick={() => void saveEvents()} className="rounded-lg bg-[#334785] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Đang lưu…" : "Lưu nhật ký sự kiện"}</button></div>
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-extrabold text-[#173b64]">4. Xuất file BCSX_NMD</h2>
      <p className="mt-1 text-sm text-slate-500">Xuất đúng định dạng file mẫu gốc, đã điền số liệu — nhớ Lưu bảng thông số, Lưu số liệu tổng ngày và Lưu nhật ký sự kiện trước khi xuất. File A0 cộng S1+S2 cho P/Q/P điểm bán; riêng Utc 220 kV lấy S1. Nhật ký sự kiện A0 xếp các dòng của S1 trước rồi đến S2.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["A0", "S1", "S2"] as const).map(target => <button key={target} type="button" disabled={exporting !== null} onClick={() => void exportFile(target)} className="rounded-lg border border-[#334785] bg-white px-4 py-2 text-sm font-bold text-[#334785] disabled:opacity-50">{exporting === target ? "Đang xuất…" : `Xuất BCSX_NMD_${target}`}</button>)}
      </div>
    </div>
  </div>;
}
