"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, ImagePlus, Loader2, RefreshCw, Trash2, TriangleAlert, Expand, ArrowRight, Images } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/coal-dialog";
import styles from "./coal-meter-photo-import.module.css";
import type { CtktktDayEntries } from "@/lib/ctktkt-report";
import {coalGeminiRequestHeaders,DEFAULT_COAL_GEMINI_MODEL} from "@/lib/coal-gemini-config";
import {CoalGeminiSharedSettings} from "@/components/coal-gemini-shared-settings";
import {
  ALL_COAL_METER_KEYS,
  COAL_SLOTS,
  coalMeterCell,
  coalMeterLabel,
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

async function readPhoto(file: File, reportDate:string, slot:CoalSlot, temporaryKey:string, model:string, signal:AbortSignal, request:typeof fetch) {
  const exifTime = readExifTime(await file.arrayBuffer());
  const exifSlot=exifTime?slotForPhotoTime(exifTime):null;
  const response = await request("/api/coal-meter-ocr", {
    method: "POST",
    signal,
    headers: coalGeminiRequestHeaders(temporaryKey,model),
    body: JSON.stringify({ data: await photoAsJpegBase64(file), mediaType: "image/jpeg",reportDate,slot:exifSlot?.operatingDate===reportDate?exifSlot.slot:slot,exifDate:exifSlot?.operatingDate,exifSlot:exifSlot?.slot }),
  });
  const body = await response.json().catch(() => ({})) as { reading?: VisionReading; error?: string;photo?:unknown;warning?:string };
  if (!response.ok || !body.reading) throw new Error(body.error || "Không đọc được ảnh.");
  const reading = body.reading;
  const aiReasons: string[] = [];
  if(!body.photo) aiReasons.push(body.warning || "Chưa lưu ảnh đối chiếu trên máy chủ.");
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
  open, onOpenChange, reportDate, current, previous, canEditCell, onApply, request = fetch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportDate: string;
  current: CtktktDayEntries;
  previous?: CtktktDayEntries;
  canEditCell: (cell: string) => boolean;
  onApply: (values: Array<{ cell: string; value: string }>) => void;
  request?: typeof fetch;
}) {
  const [rows, setRows] = useState<PhotoRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [defaultSlot, setDefaultSlot] = useState<CoalSlot>("08");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{url:string;fileName:string}|null>(null);
  const [archive,setArchive]=useState<{id:string;slot:string;reading:VisionReading;expiresAt:number}[]>([]);
  const [archiveError,setArchiveError]=useState("");
  const [archiveVersion,setArchiveVersion]=useState(0);
  const [temporaryKey,setTemporaryKey]=useState("");
  const [geminiModel,setGeminiModel]=useState(DEFAULT_COAL_GEMINI_MODEL);
  const [keyCheck,setKeyCheck]=useState<{state:"idle"|"checking"|"ok"|"error";message:string}>({state:"idle",message:""});
  const keyCheckController=useRef<AbortController|null>(null);
  const locked=busy||keyCheck.state==="checking";
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement|null>(null);
  const replaceId = useRef<string|null>(null);
  const filesRef = useRef(new Map<string,File>());
  const urlsRef = useRef(new Map<string,string>());
  const batch = useRef(0);
  const controllers = useRef(new Map<string,AbortController>());

  function stopReading() {
    batch.current++;
    controllers.current.forEach(controller => controller.abort());
    controllers.current.clear();
    setBusy(false);
    setRows(old => old.map(row => row.state === "pending" || row.state === "reading"
      ? {...row,state:"error",write:false,error:"Đã dừng đọc ảnh. Bấm Đọc lại để tiếp tục."} : row));
  }

  function changeOpen(next:boolean) {
    if (!next) { stopReading(); resetKeyCheck(); setTemporaryKey(""); setPreview(null); }
    onOpenChange(next);
  }

  useEffect(() => () => {
    keyCheckController.current?.abort();
    batch.current++;
    controllers.current.forEach(controller => controller.abort());
    urlsRef.current.forEach(url => URL.revokeObjectURL(url));
  }, []);

  function resetKeyCheck() {
    keyCheckController.current?.abort();
    keyCheckController.current=null;
    setKeyCheck({state:"idle",message:""});
  }

  function switchToSharedKey() {
    resetKeyCheck();setTemporaryKey("");
  }

  async function checkActiveKey() {
    if(locked)return;
    const controller=new AbortController();
    keyCheckController.current=controller;
    setKeyCheck({state:"checking",message:"Đang gửi yêu cầu thử tới Gemini…"});
    try {
      const response=await request("/api/coal-gemini-settings/check",{
        method:"POST",headers:coalGeminiRequestHeaders(temporaryKey,geminiModel),body:"{}",cache:"no-store",
        signal:AbortSignal.any([controller.signal,AbortSignal.timeout(30000)]),
      });
      const body=await response.json() as {message?:string;error?:string};
      if(!response.ok||!body.message)throw new Error(body.error||"Chưa kiểm tra được Gemini.");
      if(!controller.signal.aborted)setKeyCheck({state:"ok",message:body.message});
    } catch(error) {
      if(!controller.signal.aborted)setKeyCheck({state:"error",message:error instanceof Error?error.message:"Chưa kiểm tra được Gemini."});
    } finally {
      if(keyCheckController.current===controller)keyCheckController.current=null;
    }
  }
  useEffect(()=>{
    if(!open) return;
    const controller=new AbortController();
    request(`/api/coal-meter-photos?date=${encodeURIComponent(reportDate)}`,{signal:controller.signal,cache:"no-store"})
      .then(async response=>{
        if(!response.ok) throw new Error("Chưa tải được ảnh lưu.");
        return response.json() as Promise<{photos:typeof archive}>;
      }).then(body=>{setArchive(body.photos||[]);setArchiveError("");})
      .catch(()=>{if(!controller.signal.aborted)setArchiveError("Chưa tải được ảnh đã lưu. Có thể thử tải lại bên dưới.");});
    return ()=>controller.abort();
  },[open,reportDate,archiveVersion,request]);

  const reviewed = useMemo(() => rows.map(row => {
    const slot = row.slot || null;
    const value = row.value.trim() === "" ? null : Number(row.value.replace(",", "."));
    const numeric = value !== null && Number.isFinite(value) ? value : null;
    const previousValue = row.key && slot ? previousCoalReading(row.key, slot, current, previous) : null;
    const match = { key: row.key || null, previous: previousValue, delta: numeric !== null && previousValue !== null ? numeric - previousValue : null, source: null };
    const duplicate = Boolean(row.key && slot && rows.some(other => other.id !== row.id && other.key === row.key && other.slot === slot));
    const review = row.state === "done"
      ? reviewCoalReading({ value: numeric, match, label: row.label, slot, photoDate: row.photoDate, reportDate, duplicate }) : null;
    if (review && row.aiReasons.length) { review.reasons.unshift(...row.aiReasons); review.level = "check"; }
    const cell = row.key && slot ? coalMeterCell(row.key, slot) : null;
    const allowed = cell ? canEditCell(cell) : false;
    return { row, numeric, match, review, cell, allowed,
      canWrite: row.state === "done" && numeric !== null && numeric >= 0 && allowed && !duplicate };
  }), [rows, current, previous, reportDate, canEditCell]);
  const active = reviewed.find(item => item.row.id === selectedId) || reviewed[0];
  const writable = reviewed.filter(item => item.row.write && item.canWrite);
  const failed = rows.filter(row => row.state === "error");
  const done = rows.filter(row => row.state === "done" || row.state === "error").length;

  // Any correction invalidates the previous confirmation, including a changed target cell.
  function updateRow(id:string, patch:Partial<PhotoRow>) {
    setRows(old=>old.map(row=>row.id===id?{...row,...patch,write:false}:row));
  }

  async function processRows(items: PhotoRow[]) {
    if (!items.length || locked) return;
    const generation = ++batch.current;
    const queue = [...items];
    setBusy(true);
    setRows(old=>old.map(row=>items.some(item=>item.id===row.id)?{...row,state:"pending",error:"",write:false}:row));
    const worker = async () => {
      while (queue.length && generation === batch.current) {
        const row = queue.shift()!;
        const file = filesRef.current.get(row.id);
        if (!file) continue; // Removed while waiting in the queue.
        const controller = new AbortController();
        controllers.current.set(row.id,controller);
        setRows(old=>old.map(item=>item.id===row.id?{...item,state:"reading",error:""}:item));
        try {
          const result = await readPhoto(file,reportDate,row.slot||defaultSlot,temporaryKey,geminiModel,controller.signal,request);
          if (generation !== batch.current || !filesRef.current.has(row.id) || controller.signal.aborted) continue;
          const timing = result.time ? slotForPhotoTime(result.time) : null;
          const numeric = result.value === null ? null : truncateTwoDecimals(result.value);
          setRows(old=>old.map(item=>item.id===row.id?{
            ...item,state:"done",ocrValue:result.value,value:numeric===null?"":String(numeric),
            label:result.label,key:result.label??"",slot:timing?.slot??defaultSlot,
            photoDate:timing?.operatingDate??null,aiReasons:result.aiReasons,error:"",write: false,
          }:item));
        } catch (caught) {
          if (generation !== batch.current || !filesRef.current.has(row.id) || controller.signal.aborted) continue;
          const message = caught instanceof Error ? caught.message : "Không đọc được ảnh. Thử đọc lại hoặc thay ảnh khác.";
          setRows(old=>old.map(item=>item.id===row.id?{...item,state:"error",error:message,write:false}:item));
        } finally {
          if (controllers.current.get(row.id)===controller) controllers.current.delete(row.id);
        }
      }
    };
    try { await Promise.all(Array.from({length:Math.min(PARALLEL_READS,queue.length)},worker)); }
    finally {
      if (generation === batch.current) { setBusy(false); setArchiveVersion(v=>v+1); }
    }
  }

  function removeRow(id:string) {
    controllers.current.get(id)?.abort();
    controllers.current.delete(id);
    filesRef.current.delete(id);
    const url=urlsRef.current.get(id);
    if (url) URL.revokeObjectURL(url);
    urlsRef.current.delete(id);
    if (preview?.url === url) setPreview(null);
    setRows(old=>old.filter(row=>row.id!==id));
    if (selectedId===id) setSelectedId("");
    if (busy) heading.current?.focus(); else uploadButton.current?.focus();
  }

  function clearAll() {
    stopReading();
    resetKeyCheck();
    urlsRef.current.forEach(url=>URL.revokeObjectURL(url));
    urlsRef.current.clear(); filesRef.current.clear();
    replaceId.current=null;
    setRows([]); setSelectedId(""); setPreview(null); setError("");
    if (fileInput.current) fileInput.current.value="";
    if (busy) heading.current?.focus(); else uploadButton.current?.focus();
  }

  function chooseFiles(id?:string) {
    if(locked)return;
    replaceId.current=id??null;
    fileInput.current?.click();
  }

  function addFiles(files: FileList | null) {
    if (!files?.length || locked) return;
    const replacing=replaceId.current;
    replaceId.current=null;
    const selected=Array.from(files).filter(file=>["image/jpeg","image/png","image/webp"].includes(file.type)&&file.size>0&&file.size<=15_000_000)
      .slice(0,replacing?1:Math.max(0,24-rows.length));
    setError(selected.length!==files.length ? "Nhận tối đa 24 ảnh JPEG/PNG/WebP, không quá 15 MB/ảnh. Các file không phù hợp đã bỏ qua." : "");
    if (fileInput.current) fileInput.current.value=""; // Re-selecting the same file must trigger change.
    if (!selected.length) return;
    if (replacing) removeRow(replacing);
    const added:PhotoRow[]=selected.map(file=>{
      const id=crypto.randomUUID(),url=URL.createObjectURL(file);
      urlsRef.current.set(id,url); filesRef.current.set(id,file);
      return {id,fileName:file.name,url,state:"pending",ocrValue:null,value:"",label:null,key:"",slot:"",photoDate:null,aiReasons:[],error:"",write: false};
    });
    setRows(old=>[...old,...added]); setSelectedId(added[0].id);
    void processRows(added);
  }

  function apply() {
    if (locked || !writable.length) return;
    onApply(writable.map(item=>({cell:item.cell!,value:String(item.numeric)})));
    clearAll(); changeOpen(false);
  }

  const stateLabel = (row:PhotoRow) => row.state==="reading"?"Đang đọc…":row.state==="pending"?"Đang chờ":row.state==="error"?"Đọc chưa thành công":row.write?"Đã đối chiếu":"Chờ đối chiếu";

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogContent className={styles.dialog} onOpenAutoFocus={event=>{event.preventDefault();returnFocus.current=document.activeElement as HTMLElement;uploadButton.current?.focus();}} onCloseAutoFocus={event=>{event.preventDefault();returnFocus.current?.focus();}}>
      <header className={styles.header}>
        <div className={styles.headingIcon}><Camera size={22} aria-hidden /></div>
        <div><p className={styles.eyebrow}>NHẬP CHỈ SỐ · {reportDate.split("-").reverse().join("/")}</p>
          <DialogTitle ref={heading} tabIndex={-1} className={styles.title}>Đọc công tơ than từ ảnh</DialogTitle>
          <DialogDescription className={styles.description}>Đọc tổng lũy kế (tấn), đối chiếu ảnh rồi xác nhận điền vào bảng.</DialogDescription>
        </div>
      </header>
      <div className={styles.body}>
        <div className={styles.settings}>
          <CoalGeminiSharedSettings disabled={locked} request={request} onSaved={switchToSharedKey}/>
          <details className={styles.temporary}>
            <summary>Khóa tạm cho lượt nhập này</summary>
            <div className={styles.fields}>
              <label>Khóa Gemini tạm<input type="password" value={temporaryKey} disabled={locked} autoComplete="off" spellCheck={false} maxLength={256} onChange={e=>{resetKeyCheck();setTemporaryKey(e.target.value);}} placeholder="Để trống để dùng khóa chung"/></label>
              <label>Model Gemini tạm<input value={geminiModel} disabled={locked} spellCheck={false} maxLength={110} onChange={e=>{resetKeyCheck();setGeminiModel(e.target.value);}}/></label>
            </div>
            <p>Không thay khóa chung. Đóng cửa sổ sẽ xóa ô khóa tạm.</p>
            {temporaryKey&&<button type="button" disabled={locked} onClick={switchToSharedKey}>Xóa khóa tạm / dùng khóa chung</button>}
          </details>
        </div>

        <section className={styles.keySource} aria-label="Nguồn khóa đang dùng">
          <div><strong>{temporaryKey.trim()?`Đang dùng khóa tạm của bạn · ${geminiModel}`:"Đang dùng khóa chung / cấu hình máy chủ"}</strong><p>Kiểm tra Gemini gửi một yêu cầu văn bản ngắn, có dùng hạn mức Google.</p></div>
          <div className={styles.actions}>{temporaryKey.trim()&&<button type="button" disabled={locked} onClick={switchToSharedKey}>Dùng khóa chung</button>}<button type="button" disabled={locked} onClick={()=>void checkActiveKey()}><RefreshCw size={14} aria-hidden/>{keyCheck.state==="checking"?"Đang kiểm tra…":"Kiểm tra Gemini"}</button></div>
        </section>
        <div role="status" aria-live="polite">{keyCheck.state!=="idle"&&<p className={keyCheck.state==="error"?styles.error:keyCheck.state==="ok"?styles.success:styles.notice}>{keyCheck.message}</p>}</div>

        <section className={styles.toolbar} aria-label="Chọn ảnh công tơ">
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e=>addFiles(e.target.files)}/>
          <button ref={uploadButton} type="button" className={styles.primary} disabled={locked||rows.length>=24} onClick={()=>chooseFiles()}><ImagePlus size={17} aria-hidden/>Thêm ảnh công tơ</button>
          <label className={styles.shiftLabel}>Ca khi ảnh không có giờ chụp
            <select value={defaultSlot} disabled={locked} onChange={e=>setDefaultSlot(e.target.value as CoalSlot)}>{COAL_SLOTS.map(slot=><option key={slot} value={slot}>{SLOT_LABELS[slot]}</option>)}</select>
          </label>
          <span className={styles.toolbarNote}>JPEG, PNG, WebP · tối đa 24 ảnh</span>
        </section>
        <div role="status" aria-live="polite" className={styles.progress}>
          <span>{busy?<><Loader2 size={15} aria-hidden/> Đang xử lý {done}/{rows.length} ảnh. Bạn có thể xóa ảnh hoặc dừng lượt đọc.</>:rows.length?`${rows.length} ảnh · ${writable.length} đã xác nhận · ${failed.length} lỗi`:"01 Chọn ảnh → 02 Đối chiếu số → 03 Điền vào bảng"}</span>
          {rows.length>0&&<div>
            {failed.length>0&&<button type="button" disabled={locked} onClick={()=>void processRows(failed)}><RefreshCw size={14} aria-hidden/>Đọc lại ảnh lỗi</button>}
            <button type="button" onClick={clearAll}><Trash2 size={14} aria-hidden/>Xóa tất cả{busy?" / dừng":""}</button>
          </div>}
        </div>
        {error&&<p role="alert" className={styles.error}>{error}</p>}

        {active ? <div className={styles.workspace}>
          <nav className={styles.photoList} aria-label="Danh sách ảnh">
            <div className={styles.listTitle}><Images size={15} aria-hidden/>Ảnh đã chọn <span>{rows.length}/24</span></div>
            <ol>{reviewed.map(({row,canWrite},index)=><li key={row.id} data-active={row.id===active.row.id}>
              <button type="button" className={styles.photoSelect} aria-current={row.id===active.row.id?"true":undefined} onClick={()=>setSelectedId(row.id)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
                <img src={row.url} alt=""/>
                <span><strong>{index+1}. {row.key?coalMeterLabel(row.key):"Chưa rõ máy cấp"}</strong>
                  <small title={row.fileName}>{row.fileName}</small>
                  <em data-error={row.state==="error"} data-confirmed={row.write&&canWrite}>{stateLabel(row)}</em>
                </span>
              </button>
              <button type="button" className={styles.remove} aria-label={`Xóa ảnh ${index+1}`} title="Bỏ ảnh khỏi lượt nhập" onClick={()=>removeRow(row.id)}><Trash2 size={15} aria-hidden/></button>
            </li>)}</ol>
            <p>Xóa ở đây chỉ bỏ ảnh khỏi lượt nhập, không xóa số liệu trong bảng hay ảnh đã lưu.</p>
          </nav>
          <section className={styles.editor} aria-label="Đối chiếu ảnh và nhập chỉ số">
            <div className={styles.editorHeader}><div><span className={styles.eyebrow}>ẢNH {rows.findIndex(row=>row.id===active.row.id)+1} / {rows.length}</span><h3>{active.row.key?coalMeterLabel(active.row.key):"Chọn công tơ để ghi số"}</h3></div>
              <div className={styles.actions}>
                <button type="button" disabled={locked} onClick={()=>chooseFiles(active.row.id)}><ImagePlus size={15} aria-hidden/>Thay ảnh</button>
                <button type="button" disabled={locked} onClick={()=>void processRows([active.row])}><RefreshCw size={15} aria-hidden/>Đọc lại</button>
              </div>
            </div>
            <div className={styles.comparison}>
              <figure className={styles.imageFrame}>
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
                <img src={active.row.url} alt={`Ảnh công tơ ${active.row.fileName}`}/>
                <button type="button" onClick={()=>setPreview(active.row)}><Expand size={15} aria-hidden/>Phóng to ảnh</button>
                <figcaption>Đối chiếu tên máy cấp và dòng “Total / Material Total”.</figcaption>
              </figure>
              <div className={styles.reading}>
                {(active.row.state==="reading"||active.row.state==="pending")&&<div className={styles.notice}><Loader2 size={18} aria-hidden/><span>{stateLabel(active.row)}<small>Giữ nguyên ảnh trong khi chờ. Chỉ số sẽ không tự ghi vào bảng.</small></span></div>}
                {active.row.state==="error"&&<div role="alert" className={styles.error}><TriangleAlert size={18} aria-hidden/><span><strong>Chưa đọc được ảnh</strong>{active.row.error}<small>Đây là kết quả lần đọc trước. Sau khi thay hoặc lưu lại khóa, bấm Đọc lại để lấy kết quả mới. Chưa có chỉ số nào được điền.</small><button type="button" onClick={()=>updateRow(active.row.id,{state:"done",slot:defaultSlot,ocrValue:null,value:"",label:null,key:"",photoDate:null,aiReasons:["Nhập tay từ ảnh, chưa có kết quả AI và chưa lưu ảnh lên máy chủ."],error:""})}>Nhập tay từ ảnh</button></span></div>}
                <div className={styles.fields}>
                  <label>Công tơ / máy cấp<select value={active.row.key} disabled={active.row.state!=="done"} onChange={e=>updateRow(active.row.id,{key:e.target.value as CoalMeterKey|""})}>
                    <option value="">Chọn công tơ</option>{ALL_COAL_METER_KEYS.map(key=><option key={key} value={key}>{coalMeterLabel(key)}</option>)}
                  </select></label>
                  <label>Mốc ghi chỉ số<select value={active.row.slot} disabled={active.row.state!=="done"} onChange={e=>updateRow(active.row.id,{slot:e.target.value as CoalSlot})}>
                    <option value="" disabled>Chọn mốc ca</option>{COAL_SLOTS.map(slot=><option key={slot} value={slot}>{SLOT_LABELS[slot]}</option>)}
                  </select></label>
                </div>
                <label className={styles.totalLabel}>Chỉ số lũy kế <span>tấn</span>
                  <input value={active.row.value} disabled={active.row.state!=="done"} inputMode="decimal" placeholder="Chưa có kết quả" onChange={e=>updateRow(active.row.id,{value:e.target.value})}/>
                </label>
                <p className={styles.aiValue}>AI đọc: <strong>{active.row.ocrValue===null?"—":String(active.row.ocrValue)}</strong>{active.row.label?` · Nhãn: ${coalMeterLabel(active.row.label)}`:" · Chưa rõ nhãn máy cấp"}</p>
                <dl className={styles.measurements}><div><dt>Lần ghi trước</dt><dd>{active.match.previous===null?"—":numberFormat.format(active.match.previous)}</dd></div><div><dt>Tăng so với lần trước</dt><dd data-warning={active.match.delta!==null&&(active.match.delta<0||active.match.delta>1500)}>{active.match.delta===null?"—":numberFormat.format(Math.round(active.match.delta*1000)/1000)} <small>tấn</small></dd></div></dl>
                {active.review?.level==="ok"&&<p className={styles.success}><CheckCircle2 size={16} aria-hidden/>Không phát hiện bất thường. Vẫn cần đối chiếu ảnh.</p>}
                {active.review?.level==="check"&&<ul className={styles.warnings}>{active.review.reasons.map((reason,i)=><li key={i}><TriangleAlert size={14} aria-hidden/>{reason}</li>)}</ul>}
                {!active.allowed&&active.row.key&&<p className={styles.error}>Bạn không có quyền nhập ô này.</p>}
                <label className={styles.confirmation} data-checked={active.row.write&&active.canWrite}>
                  <input type="checkbox" checked={active.row.write&&active.canWrite} disabled={!active.canWrite} onChange={e=>setRows(old=>old.map(row=>row.id===active.row.id?{...row,write:e.target.checked}:row))}/>
                  <span>Tôi đã đối chiếu ảnh và số liệu<small>Đồng ý điền chỉ số này vào bảng.</small></span>
                </label>
              </div>
            </div>
          </section>
        </div>:<div className={styles.empty}><div><Camera size={32} aria-hidden/></div><h3>Chọn ảnh màn hình công tơ</h3><p>Chụp rõ mã máy cấp và tổng lũy kế. Có thể tải ảnh của cả S1 và S2 trong cùng một lượt.</p><button type="button" className={styles.primary} onClick={()=>chooseFiles()}><ImagePlus size={17} aria-hidden/>Chọn ảnh để bắt đầu</button></div>}

        <details className={styles.archive}><summary>Ảnh đã lưu của bạn · {archive.length} ảnh còn hạn</summary>
          <p>Ảnh giữ theo 4 mốc ca gần nhất. Hết hạn chỉ xóa ảnh, số liệu được giữ lại.</p>
          {archiveError&&<p role="alert" className={styles.error}>{archiveError}</p>}
          <button type="button" onClick={()=>setArchiveVersion(v=>v+1)}><RefreshCw size={14} aria-hidden/>Tải lại ảnh đã lưu</button>
          <div className={styles.archiveItems}>{archive.map(photo=><button type="button" key={photo.id} onClick={()=>setPreview({url:`/api/coal-meter-photos?id=${photo.id}`,fileName:photo.reading.meter_label||"Ảnh đã lưu"})}><strong>{photo.reading.meter_label||"Chưa rõ máy cấp"}</strong><span>{photo.reading.total_display||"—"} t · {photo.slot}h</span></button>)}</div>
        </details>
      </div>
      <footer className={styles.footer}>
        <p><strong>{writable.length} chỉ số đã xác nhận</strong><span>Sau khi điền, bấm “Lưu số liệu” ở bảng chính.</span></p>
        <div><button type="button" onClick={()=>changeOpen(false)}>Đóng{busy?" / dừng đọc":""}</button><button type="button" className={styles.primary} disabled={locked||!writable.length} onClick={apply}>Điền {writable.length} chỉ số <ArrowRight size={16} aria-hidden/></button></div>
      </footer>
    </DialogContent>
    <Dialog open={preview!==null} onOpenChange={next=>{if(!next)setPreview(null);}}>
      <DialogContent className={styles.lightbox} aria-describedby={undefined}>
        <DialogTitle className={styles.lightboxTitle}>Ảnh đối chiếu · {preview?.fileName}</DialogTitle>
        {preview&&/* eslint-disable-next-line @next/next/no-img-element -- local or authenticated temporary image */
          <img src={preview.url} alt={`Ảnh ${preview.fileName}`}/>}
      </DialogContent>
    </Dialog>
  </Dialog>;
}
