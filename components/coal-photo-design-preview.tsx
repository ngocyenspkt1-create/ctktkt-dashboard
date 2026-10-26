"use client";

import {useCallback,useRef,useState} from "react";
import {CoalMeterPhotoImport} from "./coal-meter-photo-import";
import {AnimateUIProvider} from "@animate-ui/react/provider";
import {saveReviewedCoalEntries} from "@/lib/coal-photo-save";

// Mounted only by /wb-preview, whose server page returns 404 outside development.
// This adapter never sends photos, keys or readings to a network service.
export function CoalPhotoDesignPreview() {
  const [open,setOpen]=useState(false);
  const [date,setDate]=useState("2026-10-25");
  const saved=useRef<Array<{operatingDate:string;cell:string;value:string}>>([]);
  const [mode,setMode]=useState("success");
  const modeRef=useRef(mode),count=useRef(0);
  const [applied,setApplied]=useState("");
  const [reduceMotion,setReduceMotion]=useState(false);
  const request=useCallback<typeof fetch>(async (url,options)=>{
    if(String(url).startsWith("/api/ctktkt-report")){
      if(options?.method==="POST"){
        const body=JSON.parse(String(options.body)) as {operatingDate:string;entries:Array<{cell:string;value:string}>};
        saved.current=body.entries.map(entry=>({...entry,operatingDate:body.operatingDate}));
        return Response.json({saved:body.entries.length});
      }
      return Response.json({entries:saved.current});
    }
    if (String(url)==="/api/coal-gemini-settings/check") return Response.json({message:"Minh họa: kết nối thành công. Bản local không gọi Google và chưa kiểm tra hạn mức thật."});
    if (String(url).includes("coal-gemini-settings")) return Response.json({shared:{configured:true,model:"gemini-demo",version:1,updatedAt:null,updatedBy:"Bản minh họa"}});
    if (String(url).includes("coal-meter-photos")) return Response.json({photos:[]});
    if (String(url)!=="/api/coal-meter-ocr") throw new Error("Preview does not allow network calls");
    const runMode=modeRef.current,index=count.current++;
    await new Promise<void>((resolve,reject)=>{
      const signal=options?.signal;
      const abort=()=>{clearTimeout(timer);reject(new DOMException("Stopped","AbortError"));};
      const timer=setTimeout(()=>{signal?.removeEventListener("abort",abort);resolve();},runMode==="slow"?12000:500);
      if(signal?.aborted)abort();else signal?.addEventListener("abort",abort,{once:true});
    });
    if(runMode==="error") return Response.json({error:"Gemini chưa phản hồi sau 45 giây. Ảnh vẫn ở đây; bấm Đọc lại hoặc thay ảnh rõ hơn."},{status:504});
    return Response.json({reading:{screen_type:"led_total",meter_label:index%2?"1A2":"1A1",total_display:"12345.678",total_unit:"t",photo_timestamp:null,confidence:runMode==="unclear"?"low":"high",note:"Kết quả minh họa, không phải số được đọc từ ảnh."},photo:null,warning:"Dữ liệu minh họa: ảnh chỉ được giữ trong trình duyệt, không tải lên máy chủ."});
  },[]);
  return <section className="rounded-xl border bg-card p-4 text-card-foreground" id="coal-photo-design">
    <h2 className="font-semibold">Thiết kế nhập ảnh công tơ · chỉ chạy local</h2>
    <p className="my-2 text-xs">Kiểm tra bố cục và thao tác bằng kết quả giả lập. Ảnh không gửi Gemini, số liệu không lưu thật.</p>
    <div className="flex flex-wrap gap-3"><label className="text-xs">Tình huống <select className="rounded border bg-background p-2" value={mode} onChange={e=>{setMode(e.target.value);modeRef.current=e.target.value;}}><option value="success">Đọc thành công</option><option value="unclear">Ảnh chưa rõ / nhập tay</option><option value="error">Lỗi đọc ảnh</option><option value="slow">Đọc chậm / kiểm tra dừng</option></select></label>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={reduceMotion} onChange={event=>setReduceMotion(event.target.checked)}/>Kiểm tra giảm chuyển động</label>
      <button className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white" onClick={()=>setOpen(true)}>Mở thiết kế nhập công tơ</button></div>
    {applied&&<p role="status" className="mt-2 text-xs">Kết quả kiểm tra: {applied}</p>}
    <AnimateUIProvider reducedMotion={reduceMotion?"always":"user"}><CoalMeterPhotoImport open={open} onOpenChange={setOpen} reportDate={date} onDateChange={value=>{setDate(value);return undefined;}} current={{}} previous={{AB16:"12200",AB17:"12000"}} canEditCell={()=>true} onApply={values=>setApplied(JSON.stringify(values))} onSave={async values=>{await saveReviewedCoalEntries(request,date,values);setApplied(`Đã lưu giả lập ${JSON.stringify(values)} cho ${date}`);}} request={request}/></AnimateUIProvider>
  </section>;
}
