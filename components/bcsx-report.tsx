"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { DateField } from "@/components/ui/date-field";
import { calculateCoalStock24h } from "@/lib/coal-stock";
import { EVENT_TYPES, SHIFT_METRICS, SHIFT_TIME_SLOTS, type OperatingEvent, type ShiftMetric } from "@/lib/bcsx";
import { deriveDailyValuesFromCtktkt } from "@/lib/daily-source-links";
import { previousIsoDate, type CtktktDayEntries } from "@/lib/ctktkt-report";
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

type EventDraft = { startDate: string; startTime: string; endDate: string; endTime: string; eventType: number; description: string };

function blankEventDraft(): EventDraft {
  return { startTime: "", endTime: "", eventType: 1, description: "" };
}

type TotalsDraft = { dauCuc: string; thuongPham: string; gridReceivedMwh: string; thanTieuThu: string; thanTonKho: string };

function blankTotals(): TotalsDraft {
  return { dauCuc: "", thuongPham: "", gridReceivedMwh: "", thanTieuThu: "", thanTonKho: "" };
}

function parseAndScaleMwh(valStr: string | undefined): string {
  if (!valStr || !valStr.trim()) return "";
  const clean = valStr.trim().replace(",", ".");
  const num = Number(clean);
  if (!Number.isFinite(num)) return valStr;
  // Trong daily_inputs lÆ°u Ä‘Æ¡n vá»‹ triá»‡u kWh (vÃ­ dá»¥ 10.47). Náº¿u < 100 thÃ¬ quy Ä‘á»•i sang MWh (* 1000)
  if (num > 0 && num < 100) {
    const mwh = num * 1000;
    return String(Number(mwh.toFixed(2)));
  }
  return String(num);
}

function ctktktEntriesByDate(entries: Array<{ operatingDate: string; cell: string; value: string }>) {
  const byDate = new Map<string, CtktktDayEntries>();
  for (const entry of entries) {
    const values = byDate.get(entry.operatingDate) || {};
    values[entry.cell] = entry.value;
    byDate.set(entry.operatingDate, values);
  }
  return byDate;
}

function coalStock24hText(byDate: Map<string, CtktktDayEntries>, date: string) {
  const result = calculateCoalStock24h(byDate, date);
  return { value: result.stock === null ? "" : String(Number(result.stock.toFixed(2))), missing: result.missing };
}

export function BcsxReport() {
  const user = useSessionUser();
  const isViewer = !hasPermission(user, "edit_bcsx");
  const [operatingDate, setOperatingDate] = useState(defaultOperatingDate);
  const [unit, setUnit] = useState<Unit>("S1");
  const [grids, setGrids] = useState<Record<Unit, ReadingsGrid>>({ S1: emptyGrid(), S2: emptyGrid() });
  const [events, setEvents] = useState<Record<Unit, OperatingEvent[]>>({ S1: [], S2: [] });
  const [draft, setDraft] = useState<EventDraft>({ startDate: defaultOperatingDate, startTime: "", endDate: defaultOperatingDate, endTime: "", eventType: 1, description: "" });
  const [editingEventIndex, setEditingEventIndex] = useState<number | null>(null);
  const [totals, setTotals] = useState<Record<Unit, TotalsDraft>>({ S1: blankTotals(), S2: blankTotals() });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [coalStockMissing, setCoalStockMissing] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importingSection1, setImportingSection1] = useState(false);
  const [importingOperations, setImportingOperations] = useState(false);
  const section1ImportRef = useRef<HTMLInputElement | null>(null);
  const operationImportRef = useRef<HTMLInputElement | null>(null);
  const dirtyReadingsRef = useRef(new Set<string>());

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
        const ctktktJson = await ctktktRes.json() as { entries?: { operatingDate: string; cell: string; value: string }[]; linkedEntries?: { operatingDate: string; cell: string; value: string }[]; error?: string };
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
        dirtyReadingsRef.current.clear();

        const nextEvents: Record<Unit, OperatingEvent[]> = { S1: [], S2: [] };
        for (const e of eventsJson.events || []) nextEvents[e.unit]?.push(e);
        setEvents(nextEvents);

        const byCode = new Map((totalsJson.entries || []).filter(e => e.operatingDate === operatingDate).map(e => [e.fieldCode, e.value]));
        const ktktByDate = ctktktEntriesByDate([...(ctktktJson.entries || []), ...(ctktktJson.linkedEntries || [])]);
        const ktktValues = deriveDailyValuesFromCtktkt(
          ktktByDate.get(operatingDate) || {},
          ktktByDate.get(previousIsoDate(operatingDate)),
        );
        const coalStock = coalStock24hText(ktktByDate, operatingDate);
        const stock24h = coalStock.value;
        setCoalStockMissing(coalStock.missing);

        setTotals({
          S1: {
            dauCuc: parseAndScaleMwh(ktktValues.B),
            thuongPham: parseAndScaleMwh(ktktValues.C),
            gridReceivedMwh: byCode.get("GRID_RECEIVE_S1") || "",
            thanTieuThu: ktktValues.AE_ADJ || "",
            thanTonKho: stock24h,
          },
          S2: {
            dauCuc: parseAndScaleMwh(ktktValues.H),
            thuongPham: parseAndScaleMwh(ktktValues.I),
            gridReceivedMwh: byCode.get("GRID_RECEIVE_S2") || "",
            thanTieuThu: ktktValues.AF_ADJ || "",
            thanTonKho: stock24h,
          },
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "KhÃ´ng táº£i Ä‘Æ°á»£c dá»¯ liá»‡u.");
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
    dirtyReadingsRef.current.add(`${unit}|${metric}|${index}`);
  }

  async function saveReadings() {
    setSaving(true); setError(null); setNotice(null);
    try {
      const dirtyKeys = [...dirtyReadingsRef.current].filter(key => key.startsWith(`${unit}|`));
      const entries = dirtyKeys.map(key => {
        const [, metricText, indexText] = key.split("|");
        const metric = metricText as ShiftMetric;
        const index = Number(indexText);
        return { unit, timeSlot: SHIFT_TIME_SLOTS[index], metric, value: grid[metric][index].trim() };
      });
      if (!entries.length) throw new Error(`KhÃ´ng cÃ³ Ã´ nÃ o cá»§a tá»• mÃ¡y ${unit} vá»«a thay Ä‘á»•i Ä‘á»ƒ lÆ°u.`);
      const res = await fetch("/api/shift-readings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: operatingDate, entries }) });
      const json = await res.json() as { saved?: number; error?: string };
      if (!res.ok || json.error) throw new Error(json.error || "KhÃ´ng lÆ°u Ä‘Æ°á»£c sá»‘ liá»‡u.");
      for (const key of dirtyKeys) dirtyReadingsRef.current.delete(key);
      setNotice(`ÄÃ£ lÆ°u ${json.saved ?? entries.length} Ã´ vá»«a thay Ä‘á»•i cá»§a tá»• mÃ¡y ${unit}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "KhÃ´ng lÆ°u Ä‘Æ°á»£c sá»‘ liá»‡u.");
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
      if (!response.ok || body.error) throw new Error(body.error || `KhÃ´ng ghi Ä‘Æ°á»£c Má»¥c 1 ngÃ y ${day.date}.`);
    };

    try {
      if (files.length !== 2) throw new Error("HÃ£y chá»n Ä‘á»“ng thá»i Ä‘Ãºng 2 file Excel BCSX: má»™t file S1 vÃ  má»™t file S2.");
      const formData = new FormData();
      Array.from(files).forEach(file => formData.append("files", file));
      const parseResponse = await fetch("/api/bcsx-section1-import", { method: "POST", body: formData });
      const rawParseResponse = await parseResponse.text();
      let parsed: Partial<Section1ImportPackage> & { error?: string };
      try {
        parsed = JSON.parse(rawParseResponse) as Partial<Section1ImportPackage> & { error?: string };
      } catch {
        throw new Error("MÃ¡y chá»§ khÃ´ng tráº£ dá»¯ liá»‡u JSON há»£p lá»‡ khi Ä‘á»c hai file Excel S1/S2.");
      }
      if (!parseResponse.ok || parsed.error) throw new Error(parsed.error || "KhÃ´ng Ä‘á»c Ä‘Æ°á»£c hai file Excel S1/S2.");
      if (parsed.kind !== "BCSX_SECTION_1_HISTORY" || parsed.version !== 1 || !/^\d{4}-\d{2}$/.test(parsed.month || "") || !Number.isInteger(parsed.throughDay) || Number(parsed.throughDay) < 1 || Number(parsed.throughDay) > 31 || !Array.isArray(parsed.days) || parsed.days.length !== parsed.throughDay) {
        throw new Error("GÃ³i nháº­p Má»¥c 1 BCSX khÃ´ng Ä‘Ãºng cáº¥u trÃºc.");
      }
      if (!parsed.totals || parsed.totals.failed !== 0 || parsed.totals.checks !== parsed.totals.passed) {
        throw new Error("GÃ³i nháº­p chÆ°a Ä‘áº¡t kiá»ƒm tra Ä‘áº§y Ä‘á»§; chÆ°a ghi dá»¯ liá»‡u.");
      }
      const importPackage = parsed as Section1ImportPackage;
      const expectedKeys = new Set((['S1', 'S2'] as const).flatMap(importUnit => SHIFT_TIME_SLOTS.flatMap(timeSlot => SHIFT_METRICS.map(metric => `${importUnit}|${timeSlot}|${metric.key}`))));
      const seenDates = new Set<string>();
      for (const [dayIndex, day] of importPackage.days.entries()) {
        const expectedDate = `${importPackage.month}-${String(dayIndex + 1).padStart(2, "0")}`;
        if (day.date !== expectedDate || seenDates.has(day.date) || !Array.isArray(day.entries) || day.entries.length !== expectedKeys.size) {
          throw new Error(`Dá»¯ liá»‡u ngÃ y ${day.date || "khÃ´ng rÃµ"} khÃ´ng há»£p lá»‡.`);
        }
        seenDates.add(day.date);
        const keys = new Set<string>();
        for (const entry of day.entries) {
          const key = `${entry.unit}|${entry.timeSlot}|${entry.metric}`;
          if (!expectedKeys.has(key) || keys.has(key) || !String(entry.value).trim() || !Number.isFinite(Number(entry.value))) {
            throw new Error(`Má»¥c 1 ngÃ y ${day.date} cÃ³ Ã´ thiáº¿u, trÃ¹ng hoáº·c khÃ´ng pháº£i sá»‘.`);
          }
          keys.add(key);
        }
      }
      if (importPackage.totals.days !== importPackage.days.length || importPackage.totals.entries !== importPackage.days.length * expectedKeys.size || importPackage.totals.checks !== importPackage.totals.entries || importPackage.totals.passed !== importPackage.totals.entries) {
        throw new Error("Tá»•ng kiá»ƒm tra trong gÃ³i nháº­p khÃ´ng khá»›p dá»¯ liá»‡u chi tiáº¿t.");
      }

      backup = {};
      for (const day of importPackage.days) {
        const response = await fetch(`/api/shift-readings?date=${encodeURIComponent(day.date)}`, { cache: "no-store" });
        const body = await response.json() as { entries?: Section1ImportEntry[]; error?: string };
        if (!response.ok || body.error) throw new Error(body.error || `KhÃ´ng sao lÆ°u Ä‘Æ°á»£c ngÃ y ${day.date}.`);
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
        if (!response.ok || body.error) throw new Error(body.error || `KhÃ´ng Ä‘á»c láº¡i Ä‘Æ°á»£c ngÃ y ${day.date}.`);
        const actual = new Map((body.entries || []).map(entry => [`${entry.unit}|${entry.timeSlot}|${entry.metric}`, entry.value]));
        for (const entry of day.entries) {
          const saved = actual.get(`${entry.unit}|${entry.timeSlot}|${entry.metric}`);
          if (saved === undefined || Math.abs(Number(saved) - Number(entry.value)) > 1e-9) throw new Error(`Äá»c láº¡i khÃ´ng khá»›p ${entry.unit} ${entry.timeSlot} ${entry.metric}, ngÃ y ${day.date}.`);
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
      dirtyReadingsRef.current.clear();
      setOperatingDate(lastDay.date);
      setNotice(`ÄÃ£ nháº­p vÃ  Ä‘á»c láº¡i xÃ¡c nháº­n ${importPackage.totals.entries.toLocaleString("vi-VN")} giÃ¡ trá»‹ Má»¥c 1 cho ${importPackage.days.length} ngÃ y. Má»¥c 2 vÃ  nháº­t kÃ½ sá»± kiá»‡n khÃ´ng thay Ä‘á»•i.`);
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
          rollbackMessage = " ÄÃ£ hoÃ n nguyÃªn cÃ¡c ngÃ y Ä‘Ã£ báº¯t Ä‘áº§u ghi.";
        } catch {
          rollbackMessage = " HoÃ n nguyÃªn tá»± Ä‘á»™ng khÃ´ng trá»n váº¹n; dÃ¹ng file BCSX_SECTION1_BACKUP vá»«a táº£i Ä‘á»ƒ phá»¥c há»“i.";
        }
      }
      setError(`${caught instanceof Error ? caught.message : "KhÃ´ng nháº­p Ä‘Æ°á»£c lá»‹ch sá»­ Má»¥c 1."}${rollbackMessage}`);
    } finally {
      setImportingSection1(false);
      if (section1ImportRef.current) section1ImportRef.current.value = "";
    }
  }

  async function importOperationCommands(files: FileList | null) {
    if (!files || isViewer) return;
    setImportingOperations(true); setError(null); setNotice(null);
    try {
      if (files.length !== 1) throw new Error("HÃ£y chá»n Ä‘Ãºng 1 file DanhSachLenhKetThuc dáº¡ng .xlsx.");
      const formData = new FormData();
      formData.append("file", files[0]);
      formData.append("date", operatingDate);
      const response = await fetch("/api/bcsx-operation-import", { method: "POST", body: formData });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error || "KhÃ´ng nháº­p Ä‘Æ°á»£c file lá»‡nh Ä‘iá»u Ä‘á»™.");
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
      if (!eventsResponse.ok || eventsBody.error) throw new Error(eventsBody.error || "ÄÃ£ lÆ°u vÃ  táº£i file QLKT nhÆ°ng khÃ´ng táº£i láº¡i Ä‘Æ°á»£c Má»¥c 3.");
      const nextEvents: Record<Unit, OperatingEvent[]> = { S1: [], S2: [] };
      for (const event of eventsBody.events || []) nextEvents[event.unit]?.push(event);
      setEvents(nextEvents);

      const s1Count = Number(response.headers.get("X-BCSX-S1-Events") || nextEvents.S1.length);
      const s2Count = Number(response.headers.get("X-BCSX-S2-Events") || nextEvents.S2.length);
      const ignoredRows = Number(response.headers.get("X-BCSX-Ignored-Rows") || 0);
      setNotice("ÄÃ£ tá»± lÆ°u Má»¥c 3: S1 (" + s1Count + " sá»± kiá»‡n), S2 (" + s2Count + " sá»± kiá»‡n) vÃ  táº£i file QLKT " + fileName + (ignoredRows ? ". Bá» qua " + ignoredRows + " dÃ²ng khÃ´ng thuá»™c ngÃ y Ä‘ang chá»n hoáº·c khÃ´ng Ä‘á»§ Ä‘iá»u kiá»‡n nháº­p." : "."));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "KhÃ´ng nháº­p Ä‘Æ°á»£c file lá»‡nh Ä‘iá»u Ä‘á»™.");
    } finally {
      setImportingOperations(false);
      if (operationImportRef.current) operationImportRef.current.value = "";
    }
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
      const ctktktJson = await ctktktRes.json() as { entries?: { operatingDate: string; cell: string; value: string }[]; linkedEntries?: { operatingDate: string; cell: string; value: string }[] };
      const byCode = new Map((totalsJson.entries || []).filter(e => e.operatingDate === operatingDate).map(e => [e.fieldCode, e.value]));
      const ktktByDate = ctktktEntriesByDate([...(ctktktJson.entries || []), ...(ctktktJson.linkedEntries || [])]);
      const ktktValues = deriveDailyValuesFromCtktkt(
        ktktByDate.get(operatingDate) || {},
        ktktByDate.get(previousIsoDate(operatingDate)),
      );
      const coalStock = coalStock24hText(ktktByDate, operatingDate);
      const stock24h = coalStock.value;
      setCoalStockMissing(coalStock.missing);

      setTotals({
        S1: {
          dauCuc: parseAndScaleMwh(ktktValues.B),
          thuongPham: parseAndScaleMwh(ktktValues.C),
          gridReceivedMwh: byCode.get("GRID_RECEIVE_S1") || "",
          thanTieuThu: ktktValues.AE_ADJ || "",
          thanTonKho: stock24h,
        },
        S2: {
          dauCuc: parseAndScaleMwh(ktktValues.H),
          thuongPham: parseAndScaleMwh(ktktValues.I),
          gridReceivedMwh: byCode.get("GRID_RECEIVE_S2") || "",
          thanTieuThu: ktktValues.AF_ADJ || "",
          thanTonKho: stock24h,
        },
      });
      setNotice(`ÄÃ£ náº¡p láº¡i sá»‘ liá»‡u liÃªn káº¿t vÃ  than tá»“n kho 24h tá»« Chá»‰ tiÃªu KTKT cho ngÃ y ${operatingDate.split("-").reverse().join("/")}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "KhÃ´ng táº£i láº¡i Ä‘Æ°á»£c sá»‘ liá»‡u tá»« Chá»‰ tiÃªu KTKT.");
    }
  }

  function addEvent() {
    if (!draft.startTime || !draft.description.trim()) { setError("Cáº§n nháº­p thá»i gian báº¯t Ä‘áº§u vÃ  mÃ´ táº£ sá»± kiá»‡n."); return; }
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
      if (!res.ok || json.error) throw new Error(json.error || "KhÃ´ng lÆ°u Ä‘Æ°á»£c nháº­t kÃ½ sá»± kiá»‡n.");
      setNotice(`ÄÃ£ lÆ°u nháº­t kÃ½ sá»± kiá»‡n tá»• mÃ¡y ${unit}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "KhÃ´ng lÆ°u Ä‘Æ°á»£c nháº­t kÃ½ sá»± kiá»‡n.");
    } finally {
      setSaving(false);
    }
  }

  async function exportFile(target: "S1" | "S2" | "A0") {
    setExporting(target); setError(null);
    try {
      const res = await fetch(`/api/bcsx-export?date=${operatingDate}&unit=${target}`);
      if (!res.ok) { const json = await res.json().catch(() => null) as { error?: string } | null; throw new Error(json?.error || "KhÃ´ng xuáº¥t Ä‘Æ°á»£c file."); }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = match?.[1] || `BCSX_NMD_${target}_${operatingDate}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "KhÃ´ng xuáº¥t Ä‘Æ°á»£c file.");
    } finally {
      setExporting(null);
    }
  }

  const [viewMode, setViewMode] = useState<"3shifts" | "ca1" | "ca2" | "ca3" | "scroll">("3shifts");
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pastedExcelText, setPastedExcelText] = useState("");
  const [pasteTargetStart, setPasteTargetStart] = useState<number>(0);

  const SHIFT_SLICES = useMemo(() => [
    { id: "ca1", label: "Ca 1", hours: "00:30 â€“ 08:00", start: 0, end: 16, headerColor: "bg-[#dcebf5] text-[#173b64] border-blue-200" },
    { id: "ca2", label: "Ca 2", hours: "08:30 â€“ 16:00", start: 16, end: 32, headerColor: "bg-[#dcf5e7] text-[#115e3c] border-emerald-200" },
    { id: "ca3", label: "Ca 3", hours: "16:30 â€“ 23:59", start: 32, end: 48, headerColor: "bg-[#fef3d6] text-[#854d0e] border-amber-200" },
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
          dirtyReadingsRef.current.add(`${unit}|${metricKey}|${targetRowIdx}`);
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
    if (count > 0) setNotice(`ÄÃ£ dÃ¡n ${count} giÃ¡ trá»‹ tá»« clipboard vÃ o báº£ng.`);
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
        <table className="report-data-table w-full text-xs">
          <thead>
            <tr className="bg-slate-100/90 text-[#173b64] text-[10px] font-bold">
              <th className="py-1 px-1 text-center w-[40px]">Giá»</th>
              <th className="py-1 px-0.5 text-center" title="Tá»•ng P (MW) Ä‘áº§u cá»±c mÃ¡y phÃ¡t">P cá»±c</th>
              <th className="py-1 px-0.5 text-center" title="Tá»•ng Q (MVAr) Ä‘áº§u cá»±c mÃ¡y phÃ¡t">Q cá»±c</th>
              <th className="py-1 px-0.5 text-center" title="Tá»•ng P (MW) Ä‘iá»ƒm bÃ¡n Ä‘iá»‡n">P bÃ¡n</th>
              <th className="py-1 px-0.5 text-center" title="Äiá»‡n Ã¡p thanh cÃ¡i (kV)">U Ã¡p</th>
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
                        placeholder="â€”"
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
            {needDummyRow && (
              <tr className="border-t border-slate-100 bg-slate-50/40 text-slate-300">
                <td className="py-0.5 px-1 text-center text-[10px]">â€”</td>
                <td colSpan={4} className="py-0.5 px-1 text-center text-[10px] italic text-slate-400">Káº¿t thÃºc 24h</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  const filledCount = useMemo(() => grid.P.filter(v => v.trim() !== "").length, [grid]);

  return <div className="flex flex-col gap-3">
    {/* Header trang tinh gá»n */}
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <h1 className="text-base font-extrabold text-[#173b64]">Nháº­p liá»‡u váº­n hÃ nh theo ca â€” Xuáº¥t BCSX NMÄ</h1>
          <p className="text-xs text-slate-500">Nháº­p 1 láº§n trÃªn web, xuáº¥t láº¡i Ä‘Ãºng Ä‘á»‹nh dáº¡ng file BCSX gá»­i Äiá»u Ä‘á»™ NSMO cho cáº£ 3 tá»• mÃ¡y A0/S1/S2.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-600">NgÃ y:</span>
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
      {loading && <p className="mt-1 text-xs text-slate-400">Äang táº£i dá»¯ liá»‡u ngÃ yâ€¦</p>}
    </div>

    {/* 1. Báº£ng thÃ´ng sá»‘ ná»­a giá» â€” 3 Ca song song khÃ´ng cáº§n cuá»™n */}
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-[#173b64]">
            1. Báº£ng thÃ´ng sá»‘ ná»­a giá» â€” tá»• mÃ¡y {unit}
          </h2>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
            {filledCount}/{SHIFT_TIME_SLOTS.length} Ä‘iá»ƒm Ä‘Ã£ nháº­p ({Math.round(filledCount / SHIFT_TIME_SLOTS.length * 100)}%)
          </span>
        </div>

        {/* Thanh cÃ´ng cá»¥: Cháº¿ Ä‘á»™ xem + NÃºt dÃ¡n Excel + NÃºt LÆ°u */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setViewMode("3shifts")}
              className={`rounded px-2 py-0.5 font-bold transition ${viewMode === "3shifts" ? "bg-[#334785] text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
              title="Hiá»ƒn thá»‹ 3 ca song song vá»«a khÃ­t mÃ n hÃ¬nh, khÃ´ng cáº§n cuá»™n"
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
              title="Dáº¡ng 1 cá»™t cuá»™n dá»c cá»• Ä‘iá»ƒn"
            >
              Cuá»™n dá»c
            </button>
          </div>

          <button
            type="button"
            onClick={() => { setPastedExcelText(""); setPasteModalOpen(true); }}
            className="h-7 rounded-lg border border-blue-300 bg-blue-50 px-2.5 text-xs font-bold text-[#334785] shadow-sm hover:bg-blue-100"
            title="DÃ¡n nhanh hÃ ng loáº¡t tá»« báº£ng tÃ­nh Excel"
          >
            ðŸ“‹ DÃ¡n tá»« Excel
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
            title="Chá»n Ä‘á»“ng thá»i Ä‘Ãºng 2 file Excel BCSX S1 vÃ  S2; há»‡ thá»‘ng tá»± kiá»ƒm tra, sao lÆ°u vÃ  Ä‘á»c láº¡i sau khi ghi"
          >
            {importingSection1 ? "Äang nháº­p 2 fileâ€¦" : "Chá»n 2 file S1 & S2"}
          </button>

          <button
            type="button"
            disabled={saving || isViewer}
            title={isViewer ? "TÃ i khoáº£n Chá»‰ xem khÃ´ng cÃ³ quyá»n lÆ°u dá»¯ liá»‡u." : undefined}
            onClick={() => void saveReadings()}
            className="h-7 rounded-lg bg-gradient-to-r from-[#334785] to-[#4c6bbd] px-3.5 text-xs font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
          >
            {saving ? "Äang lÆ°uâ€¦" : "LÆ°u báº£ng thÃ´ng sá»‘"}
          </button>
        </div>
      </div>

      <p className="mt-1.5 text-[11px] text-slate-500">
        ðŸ’¡ <b>Máº¹o nháº­p nhanh</b>: Báº¥m <b>Enter</b> hoáº·c <b>â†“</b> Ä‘á»ƒ nháº£y xuá»‘ng Ã´ dÆ°á»›i, <b>â†‘</b> nháº£y lÃªn trÃªn, hoáº·c báº¥m trá»±c tiáº¿p vÃ o Ã´ rá»“i áº¥n <b>Ctrl + V</b> Ä‘á»ƒ dÃ¡n dá»¯ liá»‡u copy tá»« Excel.
      </p>

      {/* Hiá»ƒn thá»‹ báº£ng theo cháº¿ Ä‘á»™ xem */}
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
            {renderShiftTable(0, 16, "Ca 1", "00:30 â€“ 08:00", "bg-[#dcebf5] text-[#173b64]")}
          </div>
        ) : viewMode === "ca2" ? (
          <div className="max-w-xl mx-auto">
            {renderShiftTable(16, 32, "Ca 2", "08:30 â€“ 16:00", "bg-[#dcf5e7] text-[#115e3c]")}
          </div>
        ) : viewMode === "ca3" ? (
          <div className="max-w-xl mx-auto">
            {renderShiftTable(32, 48, "Ca 3", "16:30 â€“ 23:59", "bg-[#fef3d6] text-[#854d0e]")}
          </div>
        ) : (
          <div className="max-h-[480px] overflow-auto rounded-xl border border-slate-200">
            <table className="report-data-table w-full text-xs">
              <thead className="sticky top-0 bg-[#dcebf5] text-[#173b64]">
                <tr>
                  <th className="p-2 text-center w-[50px]">Thá»i Ä‘iá»ƒm</th>
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

    {/* Modal Há»— trá»£ DÃ¡n nhanh tá»« Excel */}
    {pasteModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h3 className="text-sm font-extrabold text-[#173b64]">ðŸ“‹ DÃ¡n nhanh dá»¯ liá»‡u tá»« Excel vÃ o báº£ng</h3>
              <p className="mt-0.5 text-xs text-slate-500">Copy vÃ¹ng dá»¯ liá»‡u trong Excel (P, Q, P bÃ¡n, U) rá»“i dÃ¡n vÃ o Ã´ bÃªn dÆ°á»›i</p>
            </div>
            <button
              type="button"
              onClick={() => setPasteModalOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              âœ•
            </button>
          </div>

          <div className="mt-3 space-y-2.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-700">Äiá»n báº¯t Ä‘áº§u tá»«:</span>
              <select
                value={pasteTargetStart}
                onChange={e => setPasteTargetStart(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-black"
              >
                <option value={0}>Äáº§u ngÃ y (00:30)</option>
                <option value={16}>Báº¯t Ä‘áº§u Ca 2 (08:30)</option>
                <option value={32}>Báº¯t Ä‘áº§u Ca 3 (16:30)</option>
              </select>
            </div>

            <textarea
              value={pastedExcelText}
              onChange={e => setPastedExcelText(e.target.value)}
              rows={7}
              placeholder="DÃ¡n ná»™i dung copy tá»« Excel vÃ o Ä‘Ã¢y (há»— trá»£ cáº£ 4 cá»™t P, Q, P bÃ¡n, U hoáº·c 1 cá»™t dá»c)..."
              className="w-full resize-y rounded-xl border border-slate-300 bg-[#fbfcfe] p-2.5 font-mono text-xs text-black outline-none focus:border-[#334785] focus:ring-1 focus:ring-[#334785]"
            />
            <p className="text-[11px] text-slate-400">
              * Há»‡ thá»‘ng sáº½ tá»± Ä‘á»™ng tÃ¡ch cá»™t theo phÃ­m Tab vÃ  dÃ²ng theo phÃ­m Enter Ä‘á»ƒ Ä‘iá»n chÃ­nh xÃ¡c vÃ o báº£ng.
            </p>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setPasteModalOpen(false)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Há»§y
            </button>
            <button
              type="button"
              disabled={!pastedExcelText.trim()}
              onClick={() => {
                const count = applyPastedMatrix(pastedExcelText, pasteTargetStart, "P");
                setPasteModalOpen(false);
                setNotice(`ÄÃ£ Ä‘iá»n thÃ nh cÃ´ng ${count} giÃ¡ trá»‹ vÃ o báº£ng thÃ´ng sá»‘.`);
              }}
              className="rounded-lg bg-gradient-to-r from-[#334785] to-[#4c6bbd] px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
            >
              Ãp dá»¥ng vÃ o báº£ng
            </button>
          </div>
        </div>
      </div>
    )}

    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-extrabold text-[#173b64]">2. Sá»‘ liá»‡u tá»•ng ngÃ y â€” tá»• mÃ¡y {unit}</h2>
          <p className="mt-0.5 text-xs text-slate-500">ToÃ n bá»™ sá»‘ liá»‡u tá»•ng ngÃ y tá»± liÃªn káº¿t tá»« <Link href="/ctktkt-report" className="font-semibold text-[#334785] underline">Chá»‰ tiÃªu KTKT</Link>. <b>Than tá»“n kho 24h</b> = tá»“n kho 24h ngÃ y D-1 + than nháº­p 24h (I36) âˆ’ than tiÃªu thá»¥ quy áº©m S1 + S2, dÃ¹ng chung khi xuáº¥t BCSX S1, S2 vÃ  A0.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void reloadTotalsFromCtktkt()}
            className="rounded-lg border border-[#334785] bg-white px-3 py-1.5 text-xs font-bold text-[#334785] hover:bg-slate-50"
            title="Náº¡p láº¡i sá»‘ liá»‡u Má»¥c 2 má»›i nháº¥t tá»« trang Chá»‰ tiÃªu KTKT"
          >
            ðŸ”„ Náº¡p láº¡i tá»« Chá»‰ tiÃªu KTKT
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="flex flex-col text-xs font-semibold text-slate-500">
          Sáº£n lÆ°á»£ng Ä‘áº§u cá»±c (MWh)
          <input disabled value={totals[unit].dauCuc} inputMode="decimal" placeholder="â€”" title="Tá»± liÃªn káº¿t tá»« Chá»‰ tiÃªu KTKT" className="mt-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-right font-mono text-xs font-semibold text-emerald-800"/>
        </label>
        <label className="flex flex-col text-xs font-semibold text-slate-500">
          Sáº£n lÆ°á»£ng thÆ°Æ¡ng pháº©m (MWh)
          <input disabled value={totals[unit].thuongPham} inputMode="decimal" placeholder="â€”" title="Tá»± liÃªn káº¿t tá»« Chá»‰ tiÃªu KTKT" className="mt-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-right font-mono text-xs font-semibold text-emerald-800"/>
        </label>
        <label className="flex flex-col text-xs font-semibold text-slate-500">
          Than tiÃªu thá»¥ quy áº©m 8,5% (táº¥n)
          <input disabled value={totals[unit].thanTieuThu} inputMode="decimal" placeholder="â€”" title="Tá»± tÃ­nh tá»« Chá»‰ tiÃªu KTKT" className="mt-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-right font-mono text-xs font-semibold text-emerald-800"/>
        </label>
        <label className="flex flex-col text-xs font-semibold text-slate-500">
          Than tá»“n kho 24h (táº¥n, toÃ n nhÃ  mÃ¡y)
          <input disabled value={totals[unit].thanTonKho} inputMode="decimal" placeholder="â€”" title="Tá»± tÃ­nh tá»« Chá»‰ tiÃªu KTKT" className="mt-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-right font-mono text-xs font-semibold text-emerald-800"/>
        </label>
      </div>
      {coalStockMissing && <p className="mt-2 text-[11px] font-semibold text-amber-700">Than tá»“n kho 24h chÆ°a tÃ­nh Ä‘Æ°á»£c: {coalStockMissing} Nháº­p táº¡i trang Chá»‰ tiÃªu KTKT, Cá»¥m 1.</p>}
      <p className="mt-2 text-[11px] text-slate-400">CÃ¡c Ã´ mÃ u xanh lÃ  dá»¯ liá»‡u liÃªn káº¿t, khÃ´ng nháº­p láº¡i. Than tá»“n kho 24h ngÃ y 01 nháº­p má»™t láº§n táº¡i Chá»‰ tiÃªu KTKT; cÃ¡c ngÃ y sau tá»± tÃ­nh, Ä‘á»™c láº­p vá»›i than tá»“n kho 06h00 trÃªn Dá»¯ liá»‡u cÃ¡c thÃ¡ng.</p>
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-extrabold text-[#173b64]">3. TÃ¬nh hÃ¬nh váº­n hÃ nh (nháº­t kÃ½ sá»± kiá»‡n) â€” tá»• mÃ¡y {unit}</h2>
          <p className="mt-0.5 text-xs text-slate-500">Chá»n file DanhSachLenhKetThuc: há»‡ thá»‘ng tá»± nháº­n diá»‡n lá»‡nh S1/S2, lÆ°u ngay vÃ o Má»¥c 3 vÃ  táº£i file DH1 Thá»i gian váº­n hÃ nh Ä‘á»ƒ nháº­p lÃªn QLKT. CÃ³ thá»ƒ sá»­a tay sau khi nháº­p.</p>
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
            title={isViewer ? "TÃ i khoáº£n Chá»‰ xem khÃ´ng cÃ³ quyá»n nháº­p dá»¯ liá»‡u." : "Chá»n file DanhSachLenhKetThuc; há»‡ thá»‘ng tá»± lÆ°u S1/S2 vÃ  xuáº¥t file QLKT"}
            onClick={() => operationImportRef.current?.click()}
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
          >
            {importingOperations ? "Äang nháº­n diá»‡n vÃ  xuáº¥tâ€¦" : "Nháº­p file lá»‡nh & xuáº¥t QLKT"}
          </button>
          <button
            type="button"
            disabled={saving || isViewer}
            title={isViewer ? "TÃ i khoáº£n Chá»‰ xem khÃ´ng cÃ³ quyá»n lÆ°u dá»¯ liá»‡u." : undefined}
            onClick={() => void saveEvents()}
            className="rounded-lg bg-[#334785] px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {saving ? "Äang lÆ°uâ€¦" : "LÆ°u nháº­t kÃ½ sá»± kiá»‡n"}
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-xs font-semibold text-slate-500">Báº¯t Ä‘áº§u<input type="time" value={draft.startTime} onChange={e => setDraft(d => ({ ...d, startTime: e.target.value }))} className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-black"/></label>
        <label className="flex flex-col text-xs font-semibold text-slate-500">Káº¿t thÃºc<input type="time" value={draft.endTime} onChange={e => setDraft(d => ({ ...d, endTime: e.target.value }))} className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-black"/></label>
        <label className="flex flex-col text-xs font-semibold text-slate-500">Loáº¡i sá»± kiá»‡n<select value={draft.eventType} onChange={e => setDraft(d => ({ ...d, eventType: Number(e.target.value) }))} className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-black">{EVENT_TYPES.map(t => <option key={t.code} value={t.code}>{t.code} â€” {t.label}</option>)}</select></label>
        <label className="flex min-w-[220px] flex-1 flex-col text-xs font-semibold text-slate-500">MÃ´ táº£<input value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} placeholder="VÃ­ dá»¥: TÄƒng táº£i S1 tá»« 435.7MW lÃªn 536MW" className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-black"/></label>
        <button type="button" onClick={addEvent} className="rounded-lg border border-[#334785] px-3 py-1.5 text-xs font-bold text-[#334785] hover:bg-slate-50">+ ThÃªm dÃ²ng</button>
      </div>
      <div className="mt-3 overflow-auto rounded-xl border border-slate-200">
        <table className="report-data-table w-full min-w-[560px] text-xs">
          <thead className="bg-[#dcebf5] text-[#173b64]">
            <tr>
              <th className="p-2 text-left w-[80px]">Báº¯t Ä‘áº§u</th>
              <th className="p-2 text-left w-[80px]">Káº¿t thÃºc</th>
              <th className="p-2 text-center w-[60px]">Loáº¡i</th>
              <th className="p-2 text-left">Sá»± kiá»‡n</th>
              <th className="p-2 text-right w-[60px]"></th>
            </tr>
          </thead>
          <tbody>
            {unitEvents.map((e, i) => (
              <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="p-2 font-mono text-black font-semibold">{e.startAt.slice(11)}</td>
                <td className="p-2 font-mono text-black">{e.endAt ? e.endAt.slice(11) : "â€”"}</td>
                <td className="p-2 text-center text-black font-bold">{e.eventType}</td>
                <td className="p-2 text-black">{e.description}</td>
                <td className="p-2 text-right">
                  <button type="button" onClick={() => removeEvent(i)} className="text-xs font-bold text-red-500 hover:text-red-700">XÃ³a</button>
                </td>
              </tr>
            ))}
            {unitEvents.length === 0 && (
              <tr>
                <td colSpan={5} className="p-3 text-center text-slate-400 italic">
                  ChÆ°a cÃ³ sá»± kiá»‡n nÃ o cho tá»• mÃ¡y {unit} trong ngÃ y {operatingDate.split("-").reverse().join("/")}. Báº¥m &quot;Nháº­p file lá»‡nh &amp; xuáº¥t QLKT&quot; hoáº·c thÃªm dÃ²ng thá»§ cÃ´ng.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex justify-end"><button type="button" disabled={saving || isViewer} title={isViewer ? "TÃ i khoáº£n Chá»‰ xem khÃ´ng cÃ³ quyá»n lÆ°u dá»¯ liá»‡u." : undefined} onClick={() => void saveEvents()} className="rounded-lg bg-[#334785] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Äang lÆ°uâ€¦" : "LÆ°u nháº­t kÃ½ sá»± kiá»‡n"}</button></div>
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-extrabold text-[#173b64]">4. Xuáº¥t file BCSX_NMD</h2>
      <p className="mt-1 text-sm text-slate-500">Xuáº¥t Ä‘Ãºng Ä‘á»‹nh dáº¡ng file máº«u gá»‘c, Ä‘Ã£ Ä‘iá»n sá»‘ liá»‡u â€” nhá»› LÆ°u báº£ng thÃ´ng sá»‘, LÆ°u sá»‘ liá»‡u tá»•ng ngÃ y vÃ  LÆ°u nháº­t kÃ½ sá»± kiá»‡n trÆ°á»›c khi xuáº¥t. File A0 cá»™ng S1+S2 cho P/Q/P Ä‘iá»ƒm bÃ¡n; riÃªng Utc 220 kV láº¥y S1. Nháº­t kÃ½ sá»± kiá»‡n A0 xáº¿p cÃ¡c dÃ²ng cá»§a S1 trÆ°á»›c rá»“i Ä‘áº¿n S2.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["A0", "S1", "S2"] as const).map(target => <button key={target} type="button" disabled={exporting !== null} onClick={() => void exportFile(target)} className="rounded-lg border border-[#334785] bg-white px-4 py-2 text-sm font-bold text-[#334785] disabled:opacity-50">{exporting === target ? "Äang xuáº¥tâ€¦" : `Xuáº¥t BCSX_NMD_${target}`}</button>)}
      </div>
    </div>
  </div>;
}





