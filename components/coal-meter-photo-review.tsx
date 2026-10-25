"use client";
import {useEffect,useState} from "react";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {coalPhotoComparison} from "@/lib/coal-photo-review";
import {ALL_COAL_METER_KEYS,COAL_SLOTS,coalMeterLabel,parseMeterLabel,type CoalMeterKey,type CoalSlot} from "@/lib/coal-meter-ocr";
type Photo={id:string;slot:CoalSlot;expiresAt:number;reading:{meter_label:string|null;total_display:string|null;confidence?:string;note?:string}};
const display=(n:number|null)=>n===null?"—":new Intl.NumberFormat("vi-VN",{maximumFractionDigits:3}).format(n);
const labels={unmapped:"Chưa rõ máy cấp",unreadable:"Chưa đọc được số",empty:"Ô bảng đang trống",match:"Khớp số AI",different:"Khác số — cần kiểm tra"};
export function CoalMeterPhotoReview({open,onOpenChange,date,unit,current}:{open:boolean;onOpenChange:(open:boolean)=>void;date:string;unit:"S1"|"S2";current:Record<string,string>}){
  const [photos,setPhotos]=useState<Photo[]>([]),[selected,setSelected]=useState(""),[error,setError]=useState(""),[loading,setLoading]=useState(false),[reload,setReload]=useState(0);
  const [overrides,setOverrides]=useState<Record<string,{meter:CoalMeterKey|"";slot:CoalSlot}>>({});
  const [missingImage,setMissingImage]=useState("");
  useEffect(()=>{
    if(!open)return;
    const controller=new AbortController();
    async function load(){setLoading(true);setError("");try{const response=await fetch(`/api/coal-meter-photos?scope=review&date=${encodeURIComponent(date)}`,{signal:controller.signal,cache:"no-store"});const body=await response.json() as {photos?:Photo[];error?:string};if(!response.ok)throw new Error(body.error||"Chưa tải được ảnh.");if(!controller.signal.aborted)setPhotos(body.photos||[]);}catch(error){if(!controller.signal.aborted){setPhotos([]);setError(error instanceof Error?error.message:"Chưa tải được ảnh.");}}finally{if(!controller.signal.aborted)setLoading(false);}}
    void load();return ()=>controller.abort();
  },[open,date,reload]);
  const visible=photos.filter(photo=>!parseMeterLabel(photo.reading.meter_label||"")||parseMeterLabel(photo.reading.meter_label||"")?.startsWith(unit));
  const photo=visible.find(p=>p.id===selected)||visible[0];
  const selection=photo?overrides[photo.id]||{meter:parseMeterLabel(photo.reading.meter_label||"")||"",slot:photo.slot}:null;
  const comparison=photo&&selection?coalPhotoComparison(photo.reading,selection.slot,current,selection.meter||null):null;
  function change(patch:Partial<{meter:CoalMeterKey|"";slot:CoalSlot}>){if(photo&&selection)setOverrides(old=>({...old,[photo.id]:{...selection,...patch}}));}
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] max-w-[calc(100%-1rem)] gap-3 overflow-y-auto p-4 sm:max-w-6xl">
    <DialogHeader><DialogTitle>Đối chiếu ảnh & số liệu than {unit} · {date}</DialogTitle><DialogDescription>TKĐ đối chiếu ảnh VHV đã tải với số hiện trên màn hình bảng, kể cả số chưa lưu. Chỉ xem, không sửa dữ liệu. Ảnh chỉ còn trong 4 mốc ca; tối đa 200 ảnh gần nhất của ngày.</DialogDescription></DialogHeader>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{visible.length} ảnh còn hạn · Nhãn và số AI có thể đọc sai, cần xem ảnh gốc</span><button type="button" disabled={loading} onClick={()=>setReload(n=>n+1)} className="rounded-lg border border-border px-3 py-2">{loading?"Đang tải…":"Tải lại ảnh"}</button></div>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    {!loading&&!error&&!photo&&<p className="p-8 text-center text-sm text-muted-foreground">Chưa có ảnh còn hạn cho {unit} ngày này. Ảnh đã quá 4 mốc ca không còn để đối chiếu.</p>}
    {photo&&selection&&comparison&&<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="grid content-start gap-3">
        <div className="max-h-40 overflow-auto rounded-lg border border-border">{visible.map(p=><button key={p.id} type="button" onClick={()=>setSelected(p.id)} aria-pressed={p.id===photo.id} className="flex w-full items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 text-left text-sm text-card-foreground aria-pressed:bg-accent"><span>{p.reading.meter_label||"Chưa rõ tên máy"} · {p.slot}h</span><span>{p.reading.total_display||"—"} t</span></button>)}</div>
        <div className="grid grid-cols-2 gap-2"><label className="grid gap-1 text-xs">Máy cấp đối chiếu<select value={selection.meter} onChange={event=>change({meter:event.target.value as CoalMeterKey|""})} className="h-10 rounded-lg border border-input bg-background px-2 text-foreground"><option value="">Chọn theo ảnh</option>{ALL_COAL_METER_KEYS.filter(key=>key.startsWith(unit)).map(key=><option key={key} value={key}>{coalMeterLabel(key)}</option>)}</select></label><label className="grid gap-1 text-xs">Mốc ca đối chiếu<select value={selection.slot} onChange={event=>change({slot:event.target.value as CoalSlot})} className="h-10 rounded-lg border border-input bg-background px-2 text-foreground">{COAL_SLOTS.map(slot=><option key={slot} value={slot}>{slot}h</option>)}</select></label></div>
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground"><div><p className="text-xs text-muted-foreground">AI đọc từ ảnh (cắt 2 số lẻ)</p><strong className="text-xl">{display(comparison.imageValue)} t</strong><p className="text-xs text-muted-foreground">Số gốc AI: {photo.reading.total_display||"—"}</p></div><div><p className="text-xs text-muted-foreground">Số trên bảng · ô {comparison.cell||"—"}</p><strong className="text-xl">{display(comparison.tableValue)} t</strong></div></div>
        <p className={`rounded-lg border p-3 text-sm ${missingImage===photo.id?"border-amber-200 bg-amber-50 text-amber-800":comparison.status==="match"?"border-emerald-200 bg-emerald-50 text-emerald-800":comparison.status==="different"?"border-red-200 bg-red-50 text-red-800":"border-amber-200 bg-amber-50 text-amber-800"}`}>{missingImage===photo.id?"Không tải được ảnh — chưa thể đối chiếu trực quan":labels[comparison.status]}{comparison.difference!==null?` · Bảng − AI: ${display(comparison.difference)} t`:""}</p>
        {photo.reading.confidence!=="high"&&<p className="text-xs text-amber-800">AI chưa chắc chắn: {photo.reading.note||"Vui lòng kiểm tra trực tiếp trên ảnh."}</p>}
        <p className="text-xs text-muted-foreground">Chọn máy/ca ở đây chỉ đổi phép so sánh, không sửa bảng. “Khớp số AI” không có nghĩa đã xác nhận ảnh đúng. Nếu sai, quay lại bảng để người có quyền sửa và lưu.</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-3 text-card-foreground"><h3 className="mb-2 text-sm font-semibold">Ảnh gốc đối chiếu</h3>
        {/* eslint-disable-next-line @next/next/no-img-element -- private expiring authenticated meter photo */}
        <img key={photo.id} onError={()=>setMissingImage(photo.id)} onLoad={()=>setMissingImage(old=>old===photo.id?"":old)} src={`/api/coal-meter-photos?scope=review&id=${encodeURIComponent(photo.id)}`} alt={`Ảnh công tơ ${photo.reading.meter_label||"chưa rõ máy"}`} className="max-h-[65vh] w-full rounded-lg object-contain"/>
        <p className="mt-2 text-xs text-muted-foreground">Có thể mở ảnh bằng menu của trình duyệt để phóng to. Ảnh hết hạn lúc {new Date(photo.expiresAt).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})}.</p>
      </div>
    </div>}
  </DialogContent></Dialog>;
}
