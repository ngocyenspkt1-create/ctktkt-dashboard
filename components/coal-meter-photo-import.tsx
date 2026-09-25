"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, ImagePlus, Loader2, TriangleAlert, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CtktktDayEntries } from "@/lib/ctktkt-report";
import {
  ALL_COAL_METER_KEYS,
  COAL_SLOTS,
  coalMeterCell,
  coalMeterLabel,
  matchCoalMeter,
  parseMeterLabel,
  parseVisionTimestamp,
  parseVisionTotal,
  previousCoalReading,
  readExifTime,
  reviewCoalReading,
  slotForPhotoTime,
  truncateTwoDecimals,
  type CoalMeterKey,
  type CoalSlot,
} from "@/lib/coal-meter-ocr";

type PhotoRow = {
  id: string;
  fileName: string;
  url: string;
  state: "pending" | "reading" | "done" | "error";
  ocrValue: number | null;
  value: string;
  label: CoalMeterKey | null;
  key: CoalMeterKey | "";
  slot: CoalSlot | "";
  photoDate: string | null;
  aiReasons: string[];
  error: string;
  write: boolean;
};

const MAX_UPLOAD_SIDE = 1600;
const PARALLEL_READS = 3;

/** Downscales on the device before upload: faster, cheaper, and plenty for the display digits. */
async function photoAsJpegBase64(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, MAX_UPLOAD_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => (result ? resolve(result) : reject(new Error("Không nén được ảnh."))), "image/jpeg", 0.88));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  } finally {
    bitmap.close();
  }
}

type VisionReading = {
  screen_type: "led_total" | "touch_material_total" | "no_total_visible" | "not_a_meter";
  meter_label: string | null;
  total_display: string | null;
  photo_timestamp: string | null;
  confidence: "high" | "medium" | "low";
  note: string;
};

async function readPhoto(file: File) {
  const exifTime = readExifTime(await file.arrayBuffer());
  const response = await fetch("/api/coal-meter-ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: await photoAsJpegBase64(file), mediaType: "image/jpeg" }),
  });
  const body = await response.json().catch(() => ({})) as { reading?: VisionReading; error?: string };
  if (!response.ok || !body.reading) throw new Error(body.error || "Không đọc được ảnh.");
  const reading = body.reading;
  const aiReasons: string[] = [];
  if (reading.screen_type === "no_total_visible") aiReasons.push("Màn hình trong ảnh không hiện chỉ số tổng");
  if (reading.screen_type === "not_a_meter") aiReasons.push("Ảnh không phải màn hình công tơ than");
  if (reading.confidence !== "high") aiReasons.push(`AI chưa chắc chắn${reading.note ? `: ${reading.note}` : ""}`);
  return {
    value: parseVisionTotal(reading.total_display),
    label: parseMeterLabel(reading.meter_label ?? ""),
    time: exifTime ?? parseVisionTimestamp(reading.photo_timestamp),
    aiReasons,
  };
}

const SLOT_LABELS: Record<CoalSlot, string> = { "08": "08h (Ca 1)", "16": "16h (Ca 2)", "24": "24h (Ca 3)" };
const numberFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 });

export function CoalMeterPhotoImport({
  open,
  onOpenChange,
  reportDate,
  current,
  previous,
  canEditCell,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportDate: string;
  current: CtktktDayEntries;
  previous?: CtktktDayEntries;
  canEditCell: (cell: string) => boolean;
  onApply: (values: Array<{ cell: string; value: string }>) => void;
}) {
  const [rows, setRows] = useState<PhotoRow[]>([]);
  const [defaultSlot, setDefaultSlot] = useState<CoalSlot>("08");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<PhotoRow | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<string[]>([]);

  useEffect(() => () => urlsRef.current.forEach(url => URL.revokeObjectURL(url)), []);

  const previousOf = (key: CoalMeterKey, slot: CoalSlot) => previousCoalReading(key, slot, current, previous);

  const reviewed = useMemo(() => rows.map(row => {
    const slot = row.slot || null;
    const value = row.value.trim() === "" ? null : Number(row.value.replace(",", "."));
    const numeric = value !== null && Number.isFinite(value) ? value : null;
    const previousValue = row.key && slot ? previousCoalReading(row.key, slot, current, previous) : null;
    const match = { key: row.key || null, previous: previousValue, delta: numeric !== null && previousValue !== null ? numeric - previousValue : null, source: null };
    const duplicate = Boolean(row.key && slot && rows.some(other => other.id !== row.id && other.key === row.key && other.slot === slot));
    const review = row.state === "done"
      ? reviewCoalReading({ value: numeric, match, label: row.label, slot, photoDate: row.photoDate, reportDate, duplicate })
      : null;
    if (review && row.aiReasons.length) {
      review.reasons.unshift(...row.aiReasons);
      review.level = "check";
    }
    const cell = row.key && slot ? coalMeterCell(row.key, slot) : null;
    return { row, numeric, match, review, cell, allowed: cell ? canEditCell(cell) : false };
  }), [rows, current, previous, reportDate, canEditCell]);

  const updateRow = (id: string, patch: Partial<PhotoRow>) => setRows(old => old.map(row => (row.id === id ? { ...row, ...patch } : row)));

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const added: PhotoRow[] = Array.from(files).filter(file => file.type.startsWith("image/")).map((file, index) => {
      const url = URL.createObjectURL(file);
      urlsRef.current.push(url);
      return { id: `${Date.now()}-${index}-${file.name}`, fileName: file.name, url, state: "pending", ocrValue: null, value: "", label: null, key: "", slot: "", photoDate: null, aiReasons: [], error: "", write: false };
    });
    const fileById = new Map(added.map((row, index) => [row.id, Array.from(files)[index]]));
    setRows(old => [...old, ...added]);
    setBusy(true);
    try {
      const queue = [...added];
      const readNext = async (): Promise<void> => {
        const row = queue.shift();
        if (!row) return;
        setRows(old => old.map(item => (item.id === row.id ? { ...item, state: "reading" } : item)));
        try {
          const result = await readPhoto(fileById.get(row.id)!);
          const timing = result.time ? slotForPhotoTime(result.time) : null;
          const slot = timing?.slot ?? defaultSlot;
          const match = result.value === null ? null : matchCoalMeter(result.value, result.label, key => previousOf(key, slot));
          const numeric = result.value === null ? null : truncateTwoDecimals(result.value);
          setRows(old => old.map(item => {
            if (item.id !== row.id) return item;
            const next: PhotoRow = { ...item, state: "done", ocrValue: result.value, value: numeric === null ? "" : String(numeric), label: result.label, key: match?.key ?? result.label ?? "", slot, photoDate: timing?.operatingDate ?? null, aiReasons: result.aiReasons };
            const status = reviewCoalReading({ value: numeric, match: match ?? { key: null, previous: null, delta: null, source: null }, label: result.label, slot, photoDate: next.photoDate, reportDate, duplicate: false });
            return { ...next, write: status.level === "ok" && result.aiReasons.length === 0 };
          }));
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : "Không đọc được ảnh.";
          setRows(old => old.map(item => (item.id === row.id ? { ...item, state: "error", error: message } : item)));
        }
        await readNext();
      };
      await Promise.all(Array.from({ length: Math.min(PARALLEL_READS, queue.length) }, () => readNext()));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không đọc được ảnh.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function removeRow(id: string) {
    setRows(old => {
      const row = old.find(item => item.id === id);
      if (row) URL.revokeObjectURL(row.url);
      return old.filter(item => item.id !== id);
    });
  }

  const writable = reviewed.filter(item => item.row.write && item.cell && item.numeric !== null && item.allowed && !(item.review?.reasons.includes("Trùng công tơ và mốc với ảnh khác")));
  const done = rows.filter(row => row.state === "done" || row.state === "error").length;

  function apply() {
    onApply(writable.map(item => ({ cell: item.cell!, value: String(item.numeric) })));
    urlsRef.current.forEach(url => URL.revokeObjectURL(url));
    urlsRef.current = [];
    setRows([]);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={next => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="max-h-[92vh] max-w-[calc(100%-1rem)] grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-3 p-4 sm:max-w-6xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Camera className="size-5 text-indigo-600" aria-hidden /> Đọc công tơ than từ ảnh</DialogTitle>
          <DialogDescription>
            Chọn ảnh chụp màn hình công tơ các máy cấp (S1 và S2 đều được). Web đọc chỉ số, tự gán công tơ theo mã máy cấp và số lần đọc trước,
            mốc giờ theo giờ chụp. Ảnh được thu nhỏ rồi gửi tới dịch vụ AI Claude để đọc số, không lưu lại trên hệ thống. Trưởng kíp đối chiếu ảnh trước khi điền vào bảng.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={event => void addFiles(event.target.files)} />
          <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
            {busy ? `Đang đọc ${done}/${rows.length} ảnh…` : "Chọn / chụp ảnh công tơ"}
          </button>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Mốc khi ảnh không có giờ chụp
            <select value={defaultSlot} onChange={event => setDefaultSlot(event.target.value as CoalSlot)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
              {COAL_SLOTS.map(slot => <option key={slot} value={slot}>{SLOT_LABELS[slot]}</option>)}
            </select>
          </label>
          {rows.length > 0 && <span className="ml-auto text-xs text-slate-500">Mỗi ảnh mất khoảng 5–15 giây, đọc song song 3 ảnh.</span>}
        </div>

        <div className="min-h-0 overflow-auto rounded-xl border border-slate-200">
          {error && <p role="alert" className="m-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {rows.length === 0 ? (
            <div className="grid place-items-center gap-2 px-4 py-14 text-center text-sm text-slate-500">
              <ImagePlus className="size-8 text-slate-300" aria-hidden />
              Chưa có ảnh. Có thể chọn cùng lúc cả 24 ảnh của hai tổ máy.
            </div>
          ) : (
            <table className="w-full min-w-[920px] text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs font-semibold text-slate-500">
                <tr>
                  <th className="p-2">Ảnh</th>
                  <th className="p-2">Công tơ</th>
                  <th className="p-2">Mốc</th>
                  <th className="p-2 text-right">Chỉ số ghi (t)</th>
                  <th className="p-2 text-right">Lần trước</th>
                  <th className="p-2 text-right">Tăng</th>
                  <th className="p-2">Kiểm tra</th>
                  <th className="p-2 text-center">Ghi</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reviewed.map(({ row, numeric, match, review, allowed }) => (
                  <tr key={row.id} className={review?.level === "check" ? "bg-amber-50/60" : undefined}>
                    <td className="p-2">
                      <button type="button" onClick={() => setPreview(row)} className="block overflow-hidden rounded-lg ring-1 ring-slate-200 hover:ring-indigo-400" title="Phóng to ảnh">
                        {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, never uploaded */}
                        <img src={row.url} alt={`Ảnh ${row.fileName}`} className="h-16 w-12 object-cover" />
                      </button>
                    </td>
                    <td className="p-2">
                      <select value={row.key} disabled={row.state !== "done"} onChange={event => updateRow(row.id, { key: event.target.value as CoalMeterKey | "" })} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm">
                        <option value="">— Chọn —</option>
                        {ALL_COAL_METER_KEYS.map(key => <option key={key} value={key}>{coalMeterLabel(key)}</option>)}
                      </select>
                      {row.label && <p className="mt-0.5 text-[11px] text-slate-400">Nhãn trên ảnh: {coalMeterLabel(row.label)}</p>}
                    </td>
                    <td className="p-2">
                      <select value={row.slot} disabled={row.state !== "done"} onChange={event => updateRow(row.id, { slot: event.target.value as CoalSlot })} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm">
                        {COAL_SLOTS.map(slot => <option key={slot} value={slot}>{SLOT_LABELS[slot]}</option>)}
                      </select>
                    </td>
                    <td className="p-2 text-right">
                      {row.state === "reading" || row.state === "pending" ? (
                        <span className="inline-flex items-center gap-1 text-slate-400"><Loader2 className="size-3.5 animate-spin" aria-hidden /> {row.state === "reading" ? "Đang đọc" : "Chờ"}</span>
                      ) : (
                        <>
                          <input value={row.value} inputMode="decimal" onChange={event => updateRow(row.id, { value: event.target.value })} className="h-9 w-32 rounded-lg border border-slate-200 bg-white px-2 text-right font-mono text-sm" />
                          {row.ocrValue !== null && <p className="mt-0.5 text-[11px] text-slate-400">Đọc được: {row.ocrValue}</p>}
                        </>
                      )}
                    </td>
                    <td className="p-2 text-right font-mono text-slate-500">{match.previous === null ? "—" : numberFormat.format(match.previous)}</td>
                    <td className={`p-2 text-right font-mono ${match.delta !== null && (match.delta < 0 || match.delta > 1500) ? "font-semibold text-red-600" : "text-slate-700"}`}>
                      {match.delta === null ? "—" : numberFormat.format(Math.round(match.delta * 1000) / 1000)}
                    </td>
                    <td className="p-2">
                      {row.state === "error" && <span className="inline-flex items-center gap-1 text-xs text-red-600"><TriangleAlert className="size-3.5" aria-hidden /> {row.error || "Không đọc được ảnh"}</span>}
                      {review?.level === "ok" && <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><CheckCircle2 className="size-3.5" aria-hidden /> Khớp</span>}
                      {review?.level === "check" && (
                        <ul className="space-y-0.5 text-[11px] text-amber-800">
                          {review.reasons.map(reason => <li key={reason} className="flex gap-1"><TriangleAlert className="mt-px size-3 shrink-0" aria-hidden />{reason}</li>)}
                        </ul>
                      )}
                      {!allowed && row.key && <p className="text-[11px] text-slate-400">Bạn không có quyền nhập ô này</p>}
                    </td>
                    <td className="p-2 text-center">
                      <input type="checkbox" aria-label="Ghi chỉ số này vào bảng" checked={row.write} disabled={row.state !== "done" || numeric === null || !allowed} onChange={event => updateRow(row.id, { write: event.target.checked })} className="size-4 accent-indigo-600" />
                    </td>
                    <td className="p-2">
                      <button type="button" onClick={() => removeRow(row.id)} disabled={busy} aria-label="Bỏ ảnh này" className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="size-4" aria-hidden /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <p className="text-xs text-slate-500">
            {rows.length > 0 && `${writable.length} chỉ số sẽ được điền · ${reviewed.filter(item => item.review?.level === "check").length} ảnh cần đối chiếu. `}
            Sau khi điền, kiểm tra bảng rồi bấm “Lưu số liệu”.
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => onOpenChange(false)} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Đóng</button>
            <button type="button" disabled={busy || writable.length === 0} onClick={apply} className="h-10 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">Điền {writable.length} chỉ số vào bảng</button>
          </div>
        </DialogFooter>

      </DialogContent>

      <Dialog open={preview !== null} onOpenChange={next => { if (!next) setPreview(null); }}>
        <DialogContent className="max-h-[95vh] max-w-[calc(100%-1rem)] bg-slate-950 p-2 sm:max-w-3xl">
          <DialogTitle className="sr-only">Ảnh công tơ {preview?.fileName}</DialogTitle>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL, never uploaded
            <img src={preview.url} alt={`Ảnh ${preview.fileName}`} className="max-h-[88vh] w-full rounded-md object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
