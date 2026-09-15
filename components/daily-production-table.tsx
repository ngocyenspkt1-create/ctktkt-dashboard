"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog as DialogPrimitive } from "radix-ui";
import { decodeQlktSyncHash, qlktFieldLabels, roundQlktValue, validateQlktSyncPayload, type QlktSyncPayload } from "@/lib/qlkt-sync";

type Group = "production" | "environment" | "operation";
type Field = { code: string; label: string; unit?: string; input?: boolean; noteFor?: string; width?: string };
type DailyRow = Record<string, string>;
type LoadedEntry = { operatingDate: string; fieldCode: string; value: string; note: string };

const groups: { key: Group; label: string; description: string }[] = [
  { key: "production", label: "Chỉ tiêu KTKT", description: "Điện năng, than và hiệu suất vận hành." },
  { key: "environment", label: "Chỉ tiêu phụ", description: "Tiêu thụ NH₃ và nước, lượng xỉ." },
  { key: "operation", label: "Thời gian vận hành, hơi cấp VH2", description: "Hơi cấp VH2, áp suất và các khoảng thời gian vận hành." },
];

const fields: Record<Group, Field[]> = {
  production: [
    { code: "B", label: "Đầu cực S1", unit: "triệu kWh", input: true }, { code: "C", label: "Điểm bán S1", unit: "triệu kWh", input: true },
    { code: "D", label: "Tự dùng S1", unit: "MWh" }, { code: "E", label: "% tự dùng S1", unit: "%" }, { code: "F", label: "Giờ phát S1", unit: "giờ", input: true }, { code: "G", label: "CS phát BQ S1", unit: "MW" },
    { code: "H", label: "Đầu cực S2", unit: "triệu kWh", input: true }, { code: "I", label: "Điểm bán S2", unit: "triệu kWh", input: true },
    { code: "J", label: "Tự dùng S2", unit: "MWh" }, { code: "K", label: "% tự dùng S2", unit: "%" }, { code: "L", label: "Giờ phát S2", unit: "giờ", input: true }, { code: "M", label: "CS phát BQ S2", unit: "MW" },
    { code: "N", label: "Tổng SL đầu cực", unit: "MWh" }, { code: "O", label: "Tổng SL điểm bán", unit: "MWh" }, { code: "P", label: "Tổng SL tự dùng", unit: "MWh" }, { code: "Q", label: "% tự dùng", unit: "%" }, { code: "R", label: "Tổng giờ phát", unit: "giờ" }, { code: "S", label: "Tổng CS phát BQ", unit: "MW" },
    { code: "X", label: "Dầu FO tiêu thụ", unit: "tấn", input: true }, { code: "AE", label: "Than tiêu thụ S1", unit: "tấn", input: true }, { code: "AF", label: "Than tiêu thụ S2", unit: "tấn", input: true }, { code: "AJ", label: "Nhiệt trị", unit: "kJ/kg", input: true },
    { code: "AR", label: "Than tồn kho", unit: "tấn", input: true }, { code: "AT", label: "Than nhập trong ngày", unit: "tấn", input: true }, { code: "CJ", label: "Độ ẩm TB ngày", unit: "%", input: true }, { code: "CX", label: "Nhiệt trị trước chỉnh", unit: "kJ/kg", input: true },
    { code: "T", label: "Tổng than tiêu thụ", unit: "tấn" }, { code: "U", label: "Suất hao than thô", unit: "g/kWh" }, { code: "V", label: "Suất hao nhiệt thô", unit: "kJ/kWh" }, { code: "W", label: "Suất hao nhiệt tinh", unit: "kJ/kWh" }, { code: "Y", label: "Suất hao than thô S1", unit: "g/kWh" }, { code: "Z", label: "Suất hao than thô S2", unit: "g/kWh" }, { code: "AA", label: "Suất hao than tinh NM", unit: "g/kWh" }, { code: "AG", label: "Suất hao than tinh S1", unit: "g/kWh" }, { code: "AH", label: "Suất hao than tinh S2", unit: "g/kWh" }, { code: "AK", label: "Nhiệt trị", unit: "kcal/kg" },
  ],
  environment: [
    { code: "BN", label: "NH₃ theo mức bồn", unit: "tấn", input: true }, { code: "BQ", label: "NH₃ DCS S1", unit: "tấn", input: true }, { code: "BR", label: "NH₃ DCS S2", unit: "tấn", input: true }, { code: "CN", label: "NH₃ nhập trong ngày", unit: "tấn", input: true },
    { code: "BO", label: "SH NH₃ đầu cực DH1", unit: "g/kWh" }, { code: "BP", label: "SH NH₃ trên lưới DH1", unit: "g/kWh" }, { code: "BS", label: "Tổng NH₃ DCS", unit: "tấn" }, { code: "BT", label: "SH NH₃ đầu cực S1", unit: "g/kWh" }, { code: "BU", label: "SH NH₃ trên lưới S1", unit: "g/kWh" }, { code: "BV", label: "SH NH₃ đầu cực S2", unit: "g/kWh" }, { code: "BW", label: "SH NH₃ trên lưới S2", unit: "g/kWh" }, { code: "BX", label: "SH NH₃ đầu cực DH1", unit: "g/kWh" }, { code: "BY", label: "SH NH₃ trên lưới DH1", unit: "g/kWh" },
    { code: "BZ", label: "Xả xỉ S1", unit: "tấn", input: true }, { code: "CA", label: "Xả xỉ S2", unit: "tấn", input: true }, { code: "CC", label: "Nước bổ sung S1", unit: "m³", input: true }, { code: "CD", label: "Nước bổ sung S2", unit: "m³", input: true },
    { code: "CE", label: "Nước tái sinh S1", unit: "m³", input: true }, { code: "CF", label: "Nước tái sinh S2", unit: "m³", input: true },
    { code: "CM", label: "Bi nghiền bổ sung", unit: "kg", input: true },
  ],
  operation: [
    { code: "CQ", label: "Hơi cấp VH2", unit: "tấn", input: true }, { code: "CR", label: "Áp suất hơi VH2", unit: "bar", input: true }, { code: "CS", label: "Thời gian dự phòng", unit: "giờ", input: true }, { code: "CT", label: "Thời gian sự cố", unit: "giờ", input: true }, { code: "CU", label: "Thời gian sửa chữa", unit: "giờ", input: true }, { code: "CV", label: "Thời gian khởi động", unit: "giờ", input: true }, { code: "CW", label: "Ghi chú vận hành", input: true, width: "min-w-64" },
  ],
};

const numericCodes = new Set(Object.values(fields).flat().filter(f => f.input && f.code !== "CW").map(f => f.code));
const currentPeriod = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).format(new Date());
const previousOperatingDate = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now()-86400000));
const numberValue = (value?: string) => { if (!value?.trim()) return null; const n = Number(value.replace(",", ".")); return Number.isFinite(n) ? n : null; };
const safeDivide = (a: number | null, b: number | null, multiplier = 1) => a === null || b === null || b === 0 ? null : a / b * multiplier;
const formatResult = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value);
const formatInputValue = (value?: string) => { if (!value) return ""; const parsed=numberValue(value); return parsed===null?value:formatResult(parsed); };

function calculate(row: DailyRow) {
  const n = (code: string) => numberValue(row[code]);
  const B=n("B"), C=n("C"), F=n("F"), H=n("H"), I=n("I"), L=n("L"), AE=n("AE"), AF=n("AF"), AJ=n("AJ"), BN=n("BN"), BQ=n("BQ"), BR=n("BR");
  const D = B === null || C === null ? null : (B-C)*1000, J = H === null || I === null ? null : (H-I)*1000;
  const N = B === null || H === null ? null : (B+H)*1000, O = C === null || I === null ? null : (C+I)*1000;
  const T = AE === null || AF === null ? null : AE+AF, BS = BQ === null || BR === null ? null : BQ+BR;
  const shTho = safeDivide(T,N,1000), shTinh = safeDivide(T,O,1000);
  return { D, E:safeDivide(D,B,0.1), G:safeDivide(B,F,1000), J, K:safeDivide(J,H,0.1), M:safeDivide(H,L,1000), N, O,
    P:N === null || O === null ? null : N-O, Q:N === null || O === null ? null : safeDivide(N-O,N,100), R:F === null || L === null ? null : F+L, S:N === null || F === null || L === null ? null : safeDivide(N,F+L),
    T, U:shTho, V:shTho === null || AJ === null ? null : shTho*AJ/1000, W:shTinh === null || AJ === null ? null : shTinh*AJ/1000, Y:safeDivide(AE,B), Z:safeDivide(AF,H), AA:shTinh, AG:safeDivide(AE,C), AH:safeDivide(AF,I), AK:AJ === null ? null : AJ/4.1868,
    BO:safeDivide(BN,N,1000), BP:safeDivide(BN,O ? O/1000 : O), BS, BT:safeDivide(BQ,B), BU:safeDivide(BQ,C), BV:safeDivide(BR,H), BW:safeDivide(BR,I), BX:safeDivide(BS,B === null || H === null ? null : B+H), BY:safeDivide(BS,C === null || I === null ? null : C+I),
  } as Record<string, number | null>;
}

function isWaterAbnormal(rows: DailyRow[], dayIndex: number, code: "CE" | "CF") {
  const current = numberValue(rows[dayIndex]?.[code]), previous = dayIndex > 0 ? numberValue(rows[dayIndex-1]?.[code]) : null;
  return current !== null && previous !== null && current > previous * 1.3 && current - previous >= 100;
}

export function DailyProductionTable() {
  const [period, setPeriod] = useState(currentPeriod), [group, setGroup] = useState<Group>("production");
  const [showCalculated, setShowCalculated] = useState(false), [rows, setRows] = useState<DailyRow[]>(() => Array.from({ length: 31 }, () => ({})));
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const [noteCell, setNoteCell] = useState<{ day: number; code: string; label: string } | null>(null), [noteDraft, setNoteDraft] = useState("");
  const [syncHelp, setSyncHelp] = useState(false), [pendingSync, setPendingSync] = useState<QlktSyncPayload | null>(null), [selectedSyncCodes, setSelectedSyncCodes] = useState<Set<string>>(new Set());
  const [syncDate, setSyncDate] = useState(previousOperatingDate), [extensionVersion, setExtensionVersion] = useState(""), [syncingQlkt, setSyncingQlkt] = useState(false);
  const [focusedCell, setFocusedCell] = useState("");
  const dirty = useRef(new Set<string>());
  const qlktRequestRef = useRef<{id:string;timer:number}|null>(null);
  const days = useMemo(() => { const [y,m] = period.split("-").map(Number); return new Date(y,m,0).getDate(); }, [period]);

  useEffect(() => { const controller = new AbortController(); setLoading(true); setError(""); setMessage(""); dirty.current.clear();
    fetch(`/api/daily-inputs?period=${encodeURIComponent(period)}`, { cache:"no-store", signal:controller.signal }).then(async r => { const body=await r.json() as { entries?:LoadedEntry[]; error?:string }; if(!r.ok) throw new Error(body.error||"Không tải được dữ liệu.");
      const next=Array.from({length:31},()=>({} as DailyRow)); for(const e of body.entries||[]){const d=Number(e.operatingDate.slice(8,10))-1; if(d>=0&&d<31){next[d][e.fieldCode]=e.value; if(e.note) next[d][`${e.fieldCode}_NOTE`]=e.note;}} setRows(next);
    }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Không tải được dữ liệu.");}).finally(()=>{if(!controller.signal.aborted)setLoading(false);}); return ()=>controller.abort(); },[period]);

  useEffect(() => {
    const payload = decodeQlktSyncHash(window.location.hash);
    if (!payload) return;
    setPendingSync(payload);
    setSelectedSyncCodes(new Set(payload.entries.map(entry => entry.fieldCode)));
    setPeriod(payload.operatingDate.slice(0, 7));
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, []);

  useEffect(() => {
    const channel="ctktkt-qlkt-sync";
    const handleMessage=(event:MessageEvent)=>{
      if(event.source!==window||event.origin!==window.location.origin)return;
      const data=event.data as {channel?:string;sender?:string;type?:string;version?:string;requestId?:string;result?:{ok?:boolean;payload?:unknown;error?:string}};
      if(!data||data.channel!==channel||data.sender!=="ctktkt-extension")return;
      if(data.type==="READY"){setExtensionVersion(String(data.version||"đã kết nối"));return;}
      if(data.type!=="SYNC_ALL_RESULT"||!qlktRequestRef.current||data.requestId!==qlktRequestRef.current.id)return;
      window.clearTimeout(qlktRequestRef.current.timer); qlktRequestRef.current=null; setSyncingQlkt(false);
      if(!data.result?.ok){setError(data.result?.error||"Chưa đồng bộ được dữ liệu từ QLKT.");return;}
      const payload=validateQlktSyncPayload(data.result.payload);
      if(!payload){setError("Dữ liệu tiện ích trả về không hợp lệ hoặc không có chỉ tiêu.");return;}
      setPendingSync(payload); setSelectedSyncCodes(new Set(payload.entries.map(entry=>entry.fieldCode))); setPeriod(payload.operatingDate.slice(0,7)); setError("");
    };
    window.addEventListener("message",handleMessage);
    window.postMessage({channel,sender:"ctktkt-web",type:"PING"},window.location.origin);
    return()=>{window.removeEventListener("message",handleMessage);if(qlktRequestRef.current)window.clearTimeout(qlktRequestRef.current.timer);};
  },[]);

  const visibleFields = fields[group].filter(f => showCalculated ? !f.input && !f.noteFor : f.input || f.noteFor);
  const tableSections = [{ label: "", items: visibleFields }];
  const displayedRows = rows.slice(0, days);
  const daysWithData = rows.slice(0, days).filter(row => Object.values(row).some(Boolean)).length;
  const abnormalCount = rows.slice(0, days).reduce((sum, _row, day) => sum + Number(isWaterAbnormal(rows, day, "CE")) + Number(isWaterAbnormal(rows, day, "CF")), 0);
  function update(day:number, code:string, value:string){ if(numericCodes.has(code) && value!=="" && !/^-?\d*(?:[.,]\d*)?$/.test(value)) return; setRows(old=>old.map((r,i)=>i===day?{...r,[code]:value}:r)); dirty.current.add(`${day}:${code.endsWith("_NOTE")?code.slice(0,-5):code}`); setMessage(""); }
  function openNote(day:number, field:Field){ setNoteCell({day,code:field.code,label:field.label}); setNoteDraft(rows[day][`${field.code}_NOTE`]||""); }
  function applyNote(){ if(!noteCell)return; update(noteCell.day,`${noteCell.code}_NOTE`,noteDraft.trim()); setNoteCell(null); setMessage("Đã cập nhật ghi chú trên bảng. Nhấn “Lưu thay đổi” để lưu vào hệ thống."); }
  function applyQlktSync(){
    if(!pendingSync)return;
    const day=Number(pendingSync.operatingDate.slice(8,10))-1;
    if(day<0||day>=days){setError("Ngày từ QLKT không thuộc tháng đang hiển thị.");return;}
    const selected=pendingSync.entries.filter(entry=>selectedSyncCodes.has(entry.fieldCode));
    setRows(old=>old.map((row,index)=>index===day?{...row,...Object.fromEntries(selected.map(entry=>[entry.fieldCode,roundQlktValue(entry.value)]))}:row));
    selected.forEach(entry=>dirty.current.add(`${day}:${entry.fieldCode}`));
    setPendingSync(null);
    setMessage(`Đã đưa ${selected.length} số liệu QLKT vào ngày ${day+1}. Kiểm tra bảng rồi nhấn “Lưu thay đổi”.`);
  }
  function syncFromQlkt(){
    setError("");setMessage("");
    if(!extensionVersion){window.postMessage({channel:"ctktkt-qlkt-sync",sender:"ctktkt-web",type:"PING"},window.location.origin);setSyncHelp(true);setError("Web chưa kết nối với tiện ích QLKT. Hãy Reload tiện ích phiên bản 0.3.1 rồi nhấn F5 trang này.");return;}
    if(qlktRequestRef.current)window.clearTimeout(qlktRequestRef.current.timer);
    const requestId=crypto.randomUUID();
    const timer=window.setTimeout(()=>{if(qlktRequestRef.current?.id!==requestId)return;qlktRequestRef.current=null;setSyncingQlkt(false);setError("QLKT phản hồi quá lâu. Hãy kiểm tra phiên đăng nhập QLKT rồi thử lại.");},90000);
    qlktRequestRef.current={id:requestId,timer};setSyncingQlkt(true);
    window.postMessage({channel:"ctktkt-qlkt-sync",sender:"ctktkt-web",type:"SYNC_ALL",requestId,operatingDate:syncDate},window.location.origin);
  }
  function noteButton(day:number, field:Field){ const hasNote=Boolean(rows[day][`${field.code}_NOTE`]?.trim()); return <button type="button" onClick={event=>{event.stopPropagation();openNote(day,field);}} aria-label={`${hasNote?"Xem hoặc sửa":"Thêm"} ghi chú cho ${field.label}, ngày ${day+1}`} title={hasNote?rows[day][`${field.code}_NOTE`]:"Thêm ghi chú"} className={`absolute right-0 top-0 z-10 h-4 w-4 ${hasNote?"opacity-100":"opacity-0 group-hover:opacity-100 focus:opacity-100"}`}><span className={`absolute right-0 top-0 h-0 w-0 border-l-[10px] border-l-transparent ${hasNote?"border-t-[10px] border-t-orange-500":"border-t-[10px] border-t-slate-300"}`}/></button>; }
  async function save(){ setError(""); setMessage(""); const missing:string[]=[]; for(let d=0;d<days;d++) for(const code of ["CE","CF"] as const) if(isWaterAbnormal(rows,d,code)&&!rows[d][`${code}_NOTE`]?.trim()) missing.push(`${code} ngày ${d+1}`);
    if(missing.length){setError(`Cần ghi rõ nguyên nhân tăng bất thường tại ${missing.join(", ")}.`); return;} const entries=[...dirty.current].map(key=>{const [dayText,code]=key.split(":"); const day=Number(dayText); return {operatingDate:`${period}-${String(day+1).padStart(2,"0")}`,fieldCode:code,value:rows[day][code]||"",note:rows[day][`${code}_NOTE`]||""};});
    if(!entries.length){setMessage("Không có thay đổi mới để lưu."); return;} setSaving(true); try{const r=await fetch("/api/daily-inputs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({period,entries})}); const b=await r.json() as {error?:string;saved?:number}; if(!r.ok)throw new Error(b.error||"Chưa lưu được dữ liệu."); dirty.current.clear(); setMessage(`Đã lưu ${b.saved||entries.length} ô dữ liệu.`);} catch(e){setError(e instanceof Error?e.message:"Chưa lưu được dữ liệu.");} finally{setSaving(false);} }

  return <section className="space-y-3">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#557187]">Dữ liệu vận hành hằng ngày</p><h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[#18233d]">Chỉ tiêu kinh tế kỹ thuật</h2><p className="mt-1 text-sm text-slate-500">Nhập trực tiếp theo tháng · kết quả được tính tự động</p></div>
      <div className="flex flex-wrap items-end justify-end gap-2"><label className="grid gap-1 text-xs font-bold text-slate-600">THÁNG<input type="month" value={period} onChange={e=>setPeriod(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm" /></label><label className="grid gap-1 text-xs font-bold text-slate-600">NGÀY ĐỒNG BỘ<input type="date" value={syncDate} onChange={e=>setSyncDate(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm" /></label><button type="button" disabled={syncingQlkt} onClick={syncFromQlkt} className="h-10 rounded-xl border border-[#b9cae5] bg-[#eef6fc] px-4 text-sm font-bold text-[#274f78] shadow-sm disabled:cursor-wait disabled:opacity-60">{syncingQlkt?"Đang đồng bộ…":"Đồng bộ QLKT"}</button><button disabled={saving||loading} onClick={save} className="h-10 rounded-xl bg-gradient-to-r from-[#4057b5] to-[#438ec1] px-5 text-sm font-bold text-white shadow-md disabled:opacity-50">{saving?"Đang lưu…":"＋ Lưu thay đổi"}</button><p className={`w-full text-right text-[11px] font-semibold ${extensionVersion?"text-emerald-700":"text-amber-700"}`}>{extensionVersion?`Tiện ích v${extensionVersion} đã kết nối`:"Chưa kết nối tiện ích"}</p></div>
    </div>

    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[{label:"Ngày trong tháng",value:days,tone:"text-[#4057b5] bg-[#f0f3ff]"},{label:"Ngày đã nhập",value:daysWithData,tone:"text-[#19845f] bg-[#edf9f4]"},{label:"Ô vừa thay đổi",value:dirty.current.size,tone:"text-[#c87819] bg-[#fff7e8]"},{label:"CE/CF bất thường",value:abnormalCount,tone:abnormalCount?"text-red-700 bg-red-50":"text-[#7451d6] bg-[#f5f1ff]"}].map(card=><div key={card.label} className={`rounded-2xl border border-white p-3 shadow-sm ${card.tone}`}><p className="text-2xl font-extrabold leading-none">{loading?"…":card.value}</p><p className="mt-1 text-xs font-semibold">{card.label}</p></div>)}
    </div>

    {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800">{error}</p>}{message&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900">{message}</p>}

    <Tabs value={group} onValueChange={v=>{setGroup(v as Group);setShowCalculated(false);}} className="gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <TabsList className="h-9 max-w-full overflow-hidden bg-[#f3f5f8] p-1">{groups.map(g=><TabsTrigger key={g.key} value={g.key} className="px-3 text-xs font-bold sm:text-sm">{g.label}</TabsTrigger>)}</TabsList>
        <div className="flex rounded-xl bg-[#f3f5f8] p-1"><button onClick={()=>setShowCalculated(false)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${!showCalculated?"bg-white text-[#354a9f] shadow-sm":"text-slate-500"}`}>Nhập liệu</button><button onClick={()=>setShowCalculated(true)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${showCalculated?"bg-white text-[#354a9f] shadow-sm":"text-slate-500"}`}>Kết quả tính</button></div>
      </div>
      <div className="border-b border-slate-100 bg-[#fbfcfd] px-3 py-2"><p className="text-xs text-slate-500">{groups.find(g=>g.key===group)?.description} · Hiển thị đầy đủ {days} ngày trong tháng.</p></div>
      {groups.map(g=><TabsContent key={g.key} value={g.key} className="mt-0">
        {visibleFields.length===0?<div className="grid h-80 place-items-center text-sm text-slate-500">Nhóm này không có cột công thức riêng.</div>:<div>{tableSections.map(section=><div key="main"><Table className="w-full table-fixed text-[11px]"><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="h-16 w-10 border-r bg-[#dcebf5] px-0.5 text-center text-[10px] font-extrabold leading-tight text-[#173b64]">Ngày</TableHead>{section.items.map(f=><TableHead key={f.code} className="h-16 whitespace-normal break-words border-r bg-[#dcebf5] px-0.5 text-center text-[10px] font-extrabold leading-[1.15] text-[#173b64]">{f.label}{f.unit&&<span className="mt-0.5 block text-[9px] font-semibold text-[#173b64]">{f.unit}</span>}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{displayedRows.map((row,d)=>{const result=calculate(row);return <TableRow key={d} className="h-9 hover:bg-[#f5faff]"><TableCell className="border-r bg-white p-0.5 text-center text-[11px] font-normal text-black">{d+1}</TableCell>{section.items.map(f=>{
            const cellKey=`${d}:${f.code}`;
            if(f.input)return <TableCell key={f.code} className="group relative border-r bg-white p-0">{noteButton(d,f)}<input aria-label={`${f.label}, ngày ${d+1}`} inputMode={f.code==="CW"?"text":"decimal"} value={focusedCell===cellKey?(row[f.code]||""):formatInputValue(row[f.code])} onFocus={()=>setFocusedCell(cellKey)} onBlur={()=>setFocusedCell("")} onChange={e=>update(d,f.code,e.target.value)} className="h-8 w-full bg-white px-1 text-center text-[11px] font-normal tabular-nums text-black outline-none focus:ring-2 focus:ring-inset focus:ring-[#4c78a8]"/></TableCell>;
            return <TableCell key={f.code} className="group relative border-r bg-white px-0.5 text-center text-[11px] font-normal tabular-nums text-black">{noteButton(d,f)}{formatResult(result[f.code]??null)}</TableCell>})}</TableRow>})}</TableBody></Table></div>)}</div>}
        <div className="flex min-h-10 items-center justify-between border-t bg-white px-3 py-2 text-[11px] text-slate-600"><span>Nền trắng: số liệu · góc cam: ô có ghi chú</span>{g.key==="environment"&&<span className="font-semibold text-amber-800">CE/CF tăng &gt;30% và ≥100 m³: bắt buộc ghi nguyên nhân</span>}</div>
      </TabsContent>)}
    </Tabs>
    <DialogPrimitive.Root open={Boolean(noteCell)} onOpenChange={open=>{if(!open)setNoteCell(null);}}><DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45"/><DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl outline-none"><div className="space-y-1"><DialogPrimitive.Title className="text-lg font-bold text-[#173b64]">Ghi chú số liệu</DialogPrimitive.Title><DialogPrimitive.Description className="text-sm text-slate-600">{noteCell?`${noteCell.label} · ngày ${noteCell.day+1}/${period.slice(5,7)}/${period.slice(0,4)}`:""}</DialogPrimitive.Description></div><label className="grid gap-2 text-sm font-semibold text-slate-700">Nguyên nhân hoặc nội dung cần lưu ý<textarea autoFocus rows={5} maxLength={500} value={noteDraft} onChange={event=>setNoteDraft(event.target.value)} placeholder="Ví dụ: Tổ máy giảm tải do xử lý thiết bị…" className="resize-none rounded-xl border border-slate-300 bg-white p-3 font-normal text-black outline-none focus:border-[#4c78a8] focus:ring-2 focus:ring-[#4c78a8]/20"/></label><p className="text-xs text-slate-500">Ô có ghi chú sẽ được đánh dấu bằng góc màu cam. Xóa hết nội dung để xóa ghi chú.</p><div className="flex justify-end gap-2"><button type="button" onClick={()=>setNoteCell(null)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Hủy</button><button type="button" onClick={applyNote} className="rounded-lg bg-[#334785] px-4 py-2 text-sm font-semibold text-white">Áp dụng ghi chú</button></div></DialogPrimitive.Content></DialogPrimitive.Portal></DialogPrimitive.Root>
    <DialogPrimitive.Root open={syncHelp} onOpenChange={setSyncHelp}><DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45"/><DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl outline-none"><DialogPrimitive.Title className="text-lg font-bold text-[#173b64]">Đồng bộ dữ liệu QLKT</DialogPrimitive.Title><DialogPrimitive.Description className="text-sm leading-6 text-slate-600">Cài tiện ích một lần trên Chrome hoặc Edge. Lần đầu, mở các màn hình Sản lượng, Nhiên liệu, Tình hình vận hành và Số liệu đo đếm công tơ để tiện ích ghi nhớ địa chỉ. Sau đó chọn ngày và dùng nút đồng bộ tương ứng.</DialogPrimitive.Description><div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-[#274f78]"><p className="font-bold">Tiện ích không đọc hoặc lưu mật khẩu.</p><p className="mt-1">Dữ liệu luôn quay về bảng kiểm tra trước và chỉ được lưu khi bạn xác nhận.</p></div><div className="flex justify-end gap-2"><button type="button" onClick={()=>setSyncHelp(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Đóng</button><a href="/qlkt-sync-extension.zip" download className="rounded-lg bg-[#334785] px-4 py-2 text-sm font-semibold text-white">Tải tiện ích mới</a></div></DialogPrimitive.Content></DialogPrimitive.Portal></DialogPrimitive.Root>
    <DialogPrimitive.Root open={Boolean(pendingSync)} onOpenChange={open=>{if(!open)setPendingSync(null);}}><DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45"/><DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 grid max-h-[86vh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl outline-none"><div><DialogPrimitive.Title className="text-lg font-bold text-[#173b64]">Kiểm tra dữ liệu từ QLKT</DialogPrimitive.Title><DialogPrimitive.Description className="mt-1 text-sm text-slate-600">Ngày {pendingSync?pendingSync.operatingDate.split("-").reverse().join("/"):""}. Bỏ chọn chỉ tiêu chưa muốn cập nhật.</DialogPrimitive.Description></div><div className="overflow-auto rounded-xl border border-slate-200"><table className="w-full text-sm"><thead><tr className="bg-[#dcebf5] text-[#173b64]"><th className="w-10 p-2 text-center">Chọn</th><th className="p-2 text-left">Chỉ tiêu</th><th className="p-2 text-center">Đang có</th><th className="p-2 text-center">Từ QLKT</th></tr></thead><tbody>{pendingSync?.entries.map(entry=>{const day=Number(pendingSync.operatingDate.slice(8,10))-1;return <tr key={entry.fieldCode} className="border-t"><td className="p-2 text-center"><input type="checkbox" checked={selectedSyncCodes.has(entry.fieldCode)} onChange={event=>setSelectedSyncCodes(old=>{const next=new Set(old);if(event.target.checked)next.add(entry.fieldCode);else next.delete(entry.fieldCode);return next;})} aria-label={`Chọn ${qlktFieldLabels[entry.fieldCode]}`}/></td><td className="p-2"><p className="font-semibold text-black">{qlktFieldLabels[entry.fieldCode]}</p><p className="text-xs text-slate-500">{entry.sourceLabel}</p></td><td className="p-2 text-center tabular-nums text-black">{formatInputValue(rows[day]?.[entry.fieldCode])||"—"}</td><td className="p-2 text-center font-bold tabular-nums text-[#173b64]">{formatInputValue(entry.value)}</td></tr>})}</tbody></table></div><div className="flex items-center justify-between gap-3"><p className="text-xs text-slate-500">Chưa ghi vào kho dữ liệu cho đến khi bạn nhấn “Lưu thay đổi”.</p><div className="flex gap-2"><button type="button" onClick={()=>setPendingSync(null)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Hủy</button><button type="button" disabled={loading||selectedSyncCodes.size===0} onClick={applyQlktSync} className="rounded-lg bg-[#334785] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Đưa vào bảng</button></div></div></DialogPrimitive.Content></DialogPrimitive.Portal></DialogPrimitive.Root>
  </section>;
}
