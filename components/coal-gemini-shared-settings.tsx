"use client";
import {useEffect,useState} from "react";
import {KeyRound,Save,RefreshCw} from "lucide-react";
import styles from "./coal-meter-photo-import.module.css";
import {DEFAULT_COAL_GEMINI_MODEL} from "@/lib/coal-gemini-config";
type Status={configured:boolean;model:string|null;version:number;updatedAt:string|null;updatedBy:string|null};
type Body={shared?:Status;environmentConfigured?:boolean;error?:string};
export function CoalGeminiSharedSettings({disabled=false,request=fetch}:{disabled?:boolean;request?:typeof fetch}){
  const [status,setStatus]=useState<Status|null>(null),[key,setKey]=useState(""),[model,setModel]=useState(DEFAULT_COAL_GEMINI_MODEL);
  const [saving,setSaving]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  const [environment,setEnvironment]=useState(false);
  const [expanded,setExpanded]=useState(false);
  const [checking,setChecking]=useState(false),[checkMessage,setCheckMessage]=useState(""),[checkError,setCheckError]=useState("");
  function accept(body:Body){if(!body.shared)throw new Error("Không nhận được trạng thái cấu hình.");setStatus(body.shared);if(body.shared.model)setModel(body.shared.model);setEnvironment(Boolean(body.environmentConfigured));setCheckMessage("");setCheckError("");}
  useEffect(()=>{
    const controller=new AbortController();
    request("/api/coal-gemini-settings",{signal:controller.signal,cache:"no-store"}).then(async response=>{const body=await response.json() as Body;if(!response.ok)throw new Error(body.error||"Chưa tải được cấu hình.");accept(body);}).catch(error=>{if(!controller.signal.aborted)setError(error instanceof Error?error.message:"Chưa tải được cấu hình.");});
    return ()=>controller.abort();
  },[request]);
  async function refresh(){
    setSaving(true);setError("");setMessage("");
    try{const response=await request("/api/coal-gemini-settings",{cache:"no-store"});const body=await response.json() as Body;if(!response.ok)throw new Error(body.error||"Chưa tải được trạng thái.");accept(body);}catch(error){setError(error instanceof Error?error.message:"Chưa tải được trạng thái.");}finally{setSaving(false);}
  }
  async function save(){
    if(!status)return;
    setSaving(true);setError("");setMessage("");
    try{
      const response=await request("/api/coal-gemini-settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:key.trim(),model:model.trim(),expectedVersion:status.version})});
      const body=await response.json() as Body;
      if(!response.ok)throw new Error(body.error||"Chưa lưu được khóa.");
      accept(body);setKey("");setMessage("Đã lưu khóa dùng chung trên máy chủ. Các VHV có quyền nhập công tơ không cần nhập lại. Chưa kiểm tra hạn mức hoặc tính hợp lệ với Google.");
    }catch(error){setError(error instanceof Error?error.message:"Chưa lưu được khóa.");}finally{setSaving(false);}
  }
  async function checkConnection(){
    setChecking(true);setCheckMessage("");setCheckError("");
    try{
      const response=await request("/api/coal-gemini-settings/check",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}",cache:"no-store"});
      const body=await response.json() as {message?:string;error?:string};
      if(!response.ok||!body.message)throw new Error(body.error||"Chưa kiểm tra được kết nối Google.");
      setCheckMessage(body.message);
    }catch(error){setCheckError(error instanceof Error?error.message:"Chưa kiểm tra được kết nối Google.");}finally{setChecking(false);}
  }
  const locked=disabled||saving||checking;
  return <section className={styles.settingsCard} aria-label="Khóa Gemini dùng chung">
    <div className={styles.settingsSummary}>
      <KeyRound size={16} aria-hidden/>
      <div><strong>Gemini dùng chung</strong><span>{checkMessage?"Đã kiểm tra khóa/model":status?.configured?"Đã lưu khóa · chưa xác nhận kết nối":status?environment?"Đang dùng cấu hình máy chủ":"Chưa có khóa chung":"Đang tải cấu hình…"}{status?.configured&&status.model?` · ${status.model}`:""}</span></div>
      <button type="button" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded?"Thu gọn":"Cấu hình Gemini"}</button>
    </div>
    {expanded&&<div className={styles.settingsForm}>
      <p>Một VHV lưu khóa, các VHV có quyền nhập công tơ dùng chung. Khóa mới sẽ thay khóa đang dùng cho mọi người. Lưu khóa chưa xác nhận quyền truy cập hoặc hạn mức của Google.</p>
      {status?.updatedBy&&<p>Cập nhật bởi {status.updatedBy}{status.updatedAt?` · ${new Date(status.updatedAt).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})}`:""}</p>}
      <div className={styles.fields}>
        <label>Khóa API muốn lưu chung<input type="password" autoComplete="off" spellCheck={false} maxLength={256} disabled={locked} value={key} onChange={event=>setKey(event.target.value)} placeholder={status?.configured?"Để trống để giữ khóa đã lưu":"Dán khóa Gemini tại đây"}/></label>
        <label>Model dùng chung<input value={model} disabled={locked} spellCheck={false} maxLength={110} onChange={event=>setModel(event.target.value)}/></label>
      </div>
      <div className={styles.actions}><button type="button" className={styles.primary} disabled={locked||!status||!key.trim()||!model.trim()} onClick={()=>void save()}><Save size={15} aria-hidden/>{saving?"Đang xử lý…":"Lưu khóa dùng chung"}</button><button type="button" disabled={locked||(!status?.configured&&!environment)} onClick={()=>void checkConnection()}><RefreshCw size={14} aria-hidden/>{checking?"Đang kiểm tra Google…":"Kiểm tra khóa đã lưu"}</button><button type="button" disabled={locked} onClick={()=>void refresh()}><RefreshCw size={14} aria-hidden/>Tải lại trạng thái</button></div>
      <p>Kiểm tra khóa đã lưu không cần tải ảnh. Nếu vừa nhập khóa/model mới trong các ô trên, hãy lưu trước rồi kiểm tra.</p>
    </div>}
    {error&&<p role="alert" className={styles.error}>{error} <button type="button" disabled={locked} onClick={()=>void refresh()}>Thử tải lại</button></p>}
    {checkError&&<p role="alert" className={styles.error}>{checkError}</p>}
    <div role="status">{message&&<p className={styles.notice}>{message}</p>}{checkMessage&&<p className={styles.notice}>{checkMessage}</p>}</div>
  </section>;
}
