"use client";

import {useEffect,useRef,useState} from "react";
import {DatabaseBackup,Download,FileJson,Upload,CheckCircle2,ShieldCheck} from "lucide-react";
import {vietnamDateIso} from "@/lib/operating-date";
import {collectBackupParts} from "@/lib/data-backup-download";
import styles from "./data-backup-panel.module.css";

type Preview={createdAt:string;range:{from:string;to:string}|null;total:number;tables:Array<{name:string;label:string;count:number}>};
const MAX_FILE_BYTES=3_000_000;
const api="/api/admin/data-backup";

export function DataBackupPanel(){
  const [today]=useState(()=>vietnamDateIso());
  const [from,setFrom]=useState(today.slice(0,7)+"-01"),[to,setTo]=useState(today);
  const [all,setAll]=useState(false),[busy,setBusy]=useState("");
  const [file,setFile]=useState<unknown>(null),[fileName,setFileName]=useState("");
  const [preview,setPreview]=useState<Preview|null>(null),[mode,setMode]=useState<"missing"|"overwrite">("missing");
  const [confirmed,setConfirmed]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const [downloadProgress,setDownloadProgress]=useState(""),[downloadError,setDownloadError]=useState("");
  const [downloadLink,setDownloadLink]=useState<{url:string;name:string}|null>(null);
  useEffect(()=>()=>{if(downloadLink)URL.revokeObjectURL(downloadLink.url);},[downloadLink]);
  const input=useRef<HTMLInputElement>(null);
  const reset=()=>{setFile(null);setFileName("");setPreview(null);setConfirmed(false);if(input.current)input.current.value="";};
  async function download(){
    setBusy("download");setError("");setNotice("");setDownloadError("");setDownloadLink(null);
    try{
      const [{default:JSZip},result]=await Promise.all([import("jszip"),collectBackupParts(all?"":`from=${from}&to=${to}`,fetch,setDownloadProgress)]);
      if(!result.total)throw new Error("Không có dữ liệu trong phạm vi đã chọn.");
      const zip=new JSZip();
      for(const file of result.files)zip.file(file.name,file.content);
      zip.file("HUONG-DAN-NAP-LAI.txt","Giải nén gói ZIP này. Trong Hệ thống → Sao lưu & nạp dữ liệu, chọn từng tệp .json để kiểm tra và xác nhận nạp. Nạp đủ mọi tệp để khôi phục toàn bộ số liệu trong gói; mặc định chỉ thêm dữ liệu thiếu. Giữ nguyên nội dung các tệp JSON. Gói không chứa tài khoản, khóa API hay ảnh công tơ. Không thay thế bản clone database đầy đủ khi chuyển cả hệ thống.\n");
      zip.file("THONG-TIN.txt",`Tạo lúc: ${new Date().toISOString()}\nPhạm vi: ${result.range?result.range.from+" → "+result.range.to:"Tất cả thời gian"}\nSố bản ghi: ${result.total}\nSố phần JSON: ${result.files.length}\nDữ liệu được đọc lần lượt theo phần; nên tải khi không có người chỉnh số liệu.\n`);
      const blob=await zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:6}});
      const url=URL.createObjectURL(blob),name=`ctktkt-backup-${all?"all":from+"_"+to}-${today}.zip`,link=document.createElement("a");
      setDownloadLink({url,name});link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();
      setDownloadProgress(`Đã tạo gói ZIP: ${result.total.toLocaleString("vi-VN")} bản ghi, ${result.files.length} phần. Nếu trình duyệt chưa tải, bấm liên kết bên dưới.`);
    }catch(e){setDownloadProgress("");setDownloadError(e instanceof Error&&e.name!=="TimeoutError"?e.message:"Một phần tải quá thời gian chờ. Chưa tạo gói hoàn chỉnh; hãy bấm tải lại.");}
    finally{setBusy("");}
  }
  async function chooseFile(selected:File|undefined){
    reset();setError("");setNotice("");
    if(!selected)return;
    setBusy("file");
    try{
      if(selected.size>MAX_FILE_BYTES)throw new Error("Tệp vượt 3 MB. Chọn bản sao lưu theo khoảng ngày ngắn hơn.");
      setFile(JSON.parse(await selected.text()));setFileName(selected.name);
    }catch(e){setError(e instanceof SyntaxError?"Tệp không phải JSON hợp lệ.":e instanceof Error?e.message:"Không đọc được tệp.");}
    finally{setBusy("");}
  }
  async function submit(action:"preview"|"restore"){
    setBusy(action);setError("");setNotice("");
    try{
      const response=await fetch(api,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,mode,file,confirmed}),signal:AbortSignal.timeout(65000)});
      const body=await response.json() as Preview&{error?:string;message?:string};
      if(!response.ok)throw new Error(body.error||"Không thực hiện được thao tác.");
      if(action==="preview"){setPreview(body);setConfirmed(false);}
      else{setNotice(body.message||"Đã nạp dữ liệu.");reset();}
    }catch(e){setError(e instanceof Error&&e.name!=="TimeoutError"?e.message:action==="restore"?"Đã hết thời gian chờ phản hồi. Kết quả nạp chưa xác định; tải bản sao lưu mới để kiểm tra dữ liệu trước khi thử lại.":"Kiểm tra tệp quá thời gian chờ; hãy thử lại.");}
    finally{setBusy("");}
  }
  return <section className={styles.workspace} aria-label="Sao lưu và nạp dữ liệu">
    <div className={styles.intro}><span className={styles.icon}><DatabaseBackup size={24}/></span><div><h2>Giữ một bản dữ liệu trên máy</h2><p>Tải tệp sao lưu, kiểm tra rồi nạp lại khi cần khôi phục số liệu.</p></div><span className={styles.admin}><ShieldCheck size={15}/>Quản trị</span></div>
    <div className={styles.grid}>
      <section className={styles.card} aria-labelledby="backup-download-title">
        <div className={styles.heading}><span className={styles.step}>01</span><div><h3 id="backup-download-title">Tải bản sao lưu</h3><p>Chọn phạm vi rồi bấm nút tải bên dưới.</p></div></div>
        <div className={styles.dates}><label>Từ ngày<input type="date" value={from} disabled={Boolean(busy)||all} onChange={e=>setFrom(e.target.value)}/></label><label>Đến ngày<input type="date" value={to} disabled={Boolean(busy)||all} onChange={e=>setTo(e.target.value)}/></label></div>
        <label className={styles.check}><input type="checkbox" checked={all} disabled={Boolean(busy)} onChange={e=>setAll(e.target.checked)}/>Tất cả thời gian</label>
        <button type="button" className={styles.primary} disabled={Boolean(busy)||(!all&&(!from||!to||from>to))} onClick={download}><Download size={18}/>{busy==="download"?"Đang tải dữ liệu…":"Tải dữ liệu về máy (.zip)"}</button>
        {downloadProgress&&<p className={styles.notice} role="status" aria-live="polite">{downloadProgress}</p>}
        {downloadError&&<p className={styles.error} role="alert">{downloadError}</p>}
        {downloadLink&&<a className={styles.downloadLink} href={downloadLink.url} download={downloadLink.name}>Bấm tại đây để tải tệp ZIP đã tạo</a>}
        <div className={styles.scope}><strong>Dữ liệu được giữ</strong><p>KTKT / PMIS, thông số BCSX, sự kiện, SHN/PPA, công tơ nước và hiệu chỉnh, hóa chất, chỉ tiêu theo kỳ và danh sách trưởng ca.</p><p>Chỉ tiêu theo kỳ lấy trọn tháng có trong khoảng chọn; danh sách trưởng ca lấy toàn bộ.</p><p>Tệp này không chứa tài khoản, mật khẩu, khóa API hoặc ảnh công tơ. Ảnh vẫn áp dụng thời hạn 4 mốc ca.</p><p>Dữ liệu tự chia thành các phần nhỏ trong một gói ZIP, không bị giới hạn tổng 12.000 bản ghi. Để nạp lại: giải nén, chọn lần lượt các tệp JSON và xác nhận nạp đủ mọi phần.</p></div>
      </section>
      <section className={styles.card} aria-labelledby="backup-restore-title">
        <div className={styles.heading}><span className={styles.step}>02</span><div><h3 id="backup-restore-title">Nạp từ bản sao lưu</h3><p>Kiểm tra tệp trước khi ghi vào hệ thống.</p></div></div>
        <div className={styles.file}><FileJson size={27}/><div><strong>{fileName||"Chọn tệp .json đã tải từ web"}</strong><p>{fileName?"Tệp đã chọn · chưa ghi dữ liệu":"Tối đa 3 MB · giữ nguyên nội dung tệp"}</p></div></div>
        <div className={styles.actions}><button type="button" disabled={Boolean(busy)} onClick={()=>input.current?.click()}><Upload size={16}/>{fileName?"Chọn tệp khác":"Chọn tệp sao lưu"}</button>{fileName&&<button type="button" disabled={Boolean(busy)} onClick={reset}>Bỏ tệp</button>}</div>
        <input ref={input} type="file" accept=".json,application/json" className={styles.hidden} aria-label="Tệp sao lưu" onChange={e=>{void chooseFile(e.target.files?.[0]);}}/>
        <label className={styles.mode}>Cách nạp<select value={mode} disabled={Boolean(busy)} onChange={e=>{setMode(e.target.value as "missing"|"overwrite");setPreview(null);setConfirmed(false);}}><option value="missing">Chỉ bổ sung bản ghi còn thiếu</option><option value="overwrite">Ghi đè bản ghi trùng bằng dữ liệu trong tệp</option></select></label>
        <p className={styles.hint}>{mode==="missing"?"Bản ghi đã có được giữ nguyên. Có thể nạp nhiều tệp theo tháng.":"Giá trị trong tệp thay thế bản ghi trùng khóa. Nên tải một bản sao hiện tại trước khi dùng cách này."} Các bản ghi ngoài tệp được giữ nguyên.</p>
        <p className={styles.hint}>Bản sao dùng để khôi phục cho cùng hệ thống. Sự kiện, hóa chất và chỉ tiêu theo kỳ nhận diện theo mã bản ghi.</p>
        <button type="button" disabled={Boolean(busy)||!file} onClick={()=>submit("preview")}><CheckCircle2 size={17}/>{busy==="preview"?"Đang kiểm tra…":"Kiểm tra tệp & xem trước"}</button>
      </section>
    </div>
    {error&&<div className={styles.error} role="alert">{error}</div>}
    {notice&&<div className={styles.notice} role="status">{notice}</div>}
    {preview&&<section className={styles.card} aria-labelledby="backup-preview-title">
      <div className={styles.previewHeader}><div><h3 id="backup-preview-title">Xem trước dữ liệu sẽ nạp</h3><p className={styles.hint}>Tạo lúc {new Date(preview.createdAt).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})} · {preview.range?`${preview.range.from} → ${preview.range.to}`:"Tất cả thời gian"}</p></div><strong>{preview.total.toLocaleString("vi-VN")} bản ghi trong tệp</strong></div>
      <div className={styles.tableWrap}><table><thead><tr><th>Nhóm dữ liệu</th><th>Số bản ghi trong tệp</th></tr></thead><tbody>{preview.tables.map(table=><tr key={table.name}><td>{table.label}</td><td>{table.count.toLocaleString("vi-VN")}</td></tr>)}</tbody></table></div>
      <label className={styles.check}><input type="checkbox" checked={confirmed} disabled={Boolean(busy)} onChange={e=>setConfirmed(e.target.checked)}/>{mode==="overwrite"?"Tôi xác nhận ghi đè các bản ghi trùng bằng dữ liệu trong tệp này.":"Tôi đã kiểm tra và đồng ý bổ sung dữ liệu còn thiếu từ tệp này."}</label>
      <button type="button" className={styles.primary} disabled={Boolean(busy)||!confirmed||preview.total===0} onClick={()=>submit("restore")}><Upload size={18}/>{busy==="restore"?"Đang nạp dữ liệu…":"Xác nhận nạp dữ liệu"}</button>
    </section>}
  </section>;
}
