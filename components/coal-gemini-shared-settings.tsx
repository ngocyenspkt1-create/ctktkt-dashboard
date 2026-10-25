"use client";
import {useEffect,useState} from "react";
import {KeyRound,Save,RefreshCw} from "lucide-react";
import {DEFAULT_COAL_GEMINI_MODEL} from "@/lib/coal-gemini-config";
type Status={configured:boolean;model:string|null;version:number;updatedAt:string|null;updatedBy:string|null};
type Body={shared?:Status;environmentConfigured?:boolean;error?:string};
export function CoalGeminiSharedSettings({disabled=false}:{disabled?:boolean}){
  const [status,setStatus]=useState<Status|null>(null),[key,setKey]=useState(""),[model,setModel]=useState(DEFAULT_COAL_GEMINI_MODEL);
  const [saving,setSaving]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  const [environment,setEnvironment]=useState(false);
  function accept(body:Body){if(!body.shared)throw new Error("Không nhận được trạng thái cấu hình.");setStatus(body.shared);if(body.shared.model)setModel(body.shared.model);setEnvironment(Boolean(body.environmentConfigured));}
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/coal-gemini-settings",{signal:controller.signal,cache:"no-store"}).then(async response=>{const body=await response.json() as Body;if(!response.ok)throw new Error(body.error||"Chưa tải được cấu hình.");accept(body);}).catch(error=>{if(!controller.signal.aborted)setError(error instanceof Error?error.message:"Chưa tải được cấu hình.");});
    return ()=>controller.abort();
  },[]);
  async function refresh(){
    setSaving(true);setError("");setMessage("");
    try{const response=await fetch("/api/coal-gemini-settings",{cache:"no-store"});const body=await response.json() as Body;if(!response.ok)throw new Error(body.error||"Chưa tải được trạng thái.");accept(body);}catch(error){setError(error instanceof Error?error.message:"Chưa tải được trạng thái.");}finally{setSaving(false);}
  }
  async function save(){
    if(!status)return;
    setSaving(true);setError("");setMessage("");
    try{
      const response=await fetch("/api/coal-gemini-settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:key.trim(),model:model.trim(),expectedVersion:status.version})});
      const body=await response.json() as Body;
      if(!response.ok)throw new Error(body.error||"Chưa lưu được khóa.");
      accept(body);setKey("");setMessage("Đã lưu khóa dùng chung trên máy chủ. Các VHV có quyền nhập công tơ không cần nhập lại. Chưa kiểm tra hạn mức hoặc tính hợp lệ với Google.");
    }catch(error){setError(error instanceof Error?error.message:"Chưa lưu được khóa.");}finally{setSaving(false);}
  }
  const locked=disabled||saving;
  return <section className="rounded-xl border border-border bg-card p-3 text-card-foreground" aria-label="Khóa Gemini dùng chung">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="size-4" aria-hidden/>Khóa API Gemini dùng chung</h3><span className="text-xs text-muted-foreground">{status?.configured?"Đã lưu trên server":status?environment?"Đang dùng cấu hình máy chủ":"Chưa có khóa chung":"Đang tải cấu hình…"}</span></div>
    <p className="mt-1 text-xs text-muted-foreground">Một VHV lưu khóa, các VHV có quyền nhập công tơ dùng chung. Khóa được mã hóa, không hiển thị lại. Lưu khóa mới sẽ thay khóa đang dùng cho mọi người.</p>
    {status?.updatedBy&&<p className="mt-1 text-xs text-muted-foreground">Cập nhật bởi {status.updatedBy}{status.updatedAt?` · ${new Date(status.updatedAt).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})}`:""}</p>}
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <label className="grid gap-1 text-xs">Khóa API muốn lưu chung<input type="password" autoComplete="off" spellCheck={false} maxLength={256} disabled={locked} value={key} onChange={event=>setKey(event.target.value)} placeholder={status?.configured?"Để trống để giữ khóa đã lưu":"Dán khóa Gemini tại đây"} className="h-10 rounded-lg border border-input bg-background px-3 text-foreground"/></label>
      <label className="grid gap-1 text-xs">Model dùng chung<input value={model} disabled={locked} spellCheck={false} maxLength={110} onChange={event=>setModel(event.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-foreground"/></label>
    </div>
    <div className="mt-2 flex flex-wrap gap-2"><button type="button" disabled={locked||!status||!key.trim()||!model.trim()} onClick={()=>void save()} className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white disabled:opacity-50"><Save className="size-4" aria-hidden/>{saving?"Đang xử lý…":"Lưu khóa dùng chung lên server"}</button><button type="button" disabled={locked} onClick={()=>void refresh()} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs"><RefreshCw className="size-3" aria-hidden/>Tải lại trạng thái</button></div>
    {error&&<p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    {message&&<p role="status" className="mt-2 text-xs text-emerald-700">{message}</p>}
  </section>;
}
