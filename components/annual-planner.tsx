"use client";

import { useState } from "react";
import { metrics, numberInput } from "../lib/metrics";
import { annualPlan } from "../lib/annual-plan";

const field = "w-full rounded-lg border border-[#9ab2b8] bg-white p-3 font-normal";
const fmt = (v: number, digits = 3) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: digits }).format(v);
const emptyMonths = () => Array.from({ length: 12 }, () => ({ production: "", usage: "" }));

export function AnnualPlanner() {
  const [code, setCode] = useState<string>("HCL");
  const [year, setYear] = useState("2026");
  const [closed, setClosed] = useState(8);
  const [target, setTarget] = useState("0,012");
  const [used, setUsed] = useState("");
  const [production, setProduction] = useState("");
  const [months, setMonths] = useState(emptyMonths);
  const [example, setExample] = useState(false);
  const metric = metrics.find(m => m.code === code)!;
  const electricity = code === "TUDUNG";
  const amountUnit = electricity ? "kWh" : "kg";
  const baseUnit = code === "BI_NGHIEN" ? "tấn than" : "kWh";
  const baseName = code === "BI_NGHIEN" ? "Than tiêu thụ" : electricity ? "Điện đầu cực" : "Điện xuất tuyến";
  let result: ReturnType<typeof annualPlan> | null = null;
  let issue = "";
  try {
    result = annualPlan({ year: numberInput(year), closedMonth: closed, kind: electricity ? "electricity" : "material", target: numberInput(target), used: numberInput(used), actualProduction: numberInput(production), future: months.slice(closed).map((r, i) => ({ month: closed + i + 1, production: numberInput(r.production), usage: r.usage.trim() === "" ? null : numberInput(r.usage) })) });
  } catch (e) { issue = e instanceof Error ? e.message : "Kiểm tra số liệu."; }
  function updateMonth(index: number, key: "production" | "usage", value: string) { setMonths(previous => previous.map((row, i) => i === index ? { ...row, [key]: value } : row)); }
  function reset(next = code) { setCode(next); setTarget(String(metrics.find(m => m.code === next)!.limit)); setUsed(""); setProduction(""); setMonths(emptyMonths()); setExample(false); }
  function loadExample() { setCode("HCL"); setYear("2026"); setClosed(8); setTarget("0,012"); setUsed("52000"); setProduction("4000000000"); setMonths(emptyMonths().map((r, i) => i >= 8 ? { ...r, production: "500000000" } : r)); setExample(true); }
  return <section id="ke-hoach-nam" className="scroll-mt-4 rounded-xl border-2 border-[#0f737a] bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-[#0f737a]">MÔ PHỎNG · KHÔNG GHI VÀO SỐ LIỆU THỰC TẾ</p><h2 className="mt-1 text-2xl font-bold">Kế hoạch đạt chỉ tiêu cả năm</h2></div><div className="flex flex-wrap gap-2"><button type="button" className="rounded-lg bg-[#123c47] px-4 py-3 font-semibold text-white" onClick={loadExample}>Thử ví dụ tháng 8</button><button type="button" className="rounded-lg border border-slate-400 px-4 py-3" onClick={() => reset()}>Xóa số liệu mô phỏng</button></div></div>
    <p className="my-4 text-sm leading-6 text-slate-600">Nhập tổng từ tháng 1 đến hết tháng chốt, không nhập riêng tháng chốt. Kế hoạch tính tại chỗ, không tự lấy lịch sử và không lưu khi tải lại trang. Không dùng dấu phân cách hàng nghìn.</p>
    {example && <p role="status" className="mb-4 rounded-lg bg-blue-50 p-3 text-blue-900">Đang dùng ví dụ giả định hoặc điều chỉnh từ ví dụ, không phải dữ liệu nhà máy.</p>}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="grid gap-2 font-semibold">Chỉ tiêu lập kế hoạch<select className={field} value={code} onChange={e => reset(e.target.value)}>{metrics.map(m => <option key={m.code} value={m.code}>{m.name}</option>)}</select></label>
      <label className="grid gap-2 font-semibold">Năm kế hoạch<input className={field} inputMode="numeric" value={year} onChange={e => setYear(e.target.value)} /></label>
      <label className="grid gap-2 font-semibold">Đã chốt đến hết tháng<select className={field} value={closed} onChange={e => { setClosed(Number(e.target.value)); setUsed(""); setProduction(""); setMonths(emptyMonths()); setExample(false); }}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>Tháng {i + 1}</option>)}</select></label>
      <label className="grid gap-2 font-semibold">Mục tiêu cả năm ({metric.unit})<input className={field} inputMode="decimal" value={target} onChange={e => setTarget(e.target.value)} /><span className="text-sm font-normal text-slate-600">Tham khảo: {fmt(metric.limit, 4)}. Thay đổi ở đây không sửa định mức thực tế.</span></label>
      <label className="grid gap-2 font-semibold">{electricity ? "Điện tự dùng" : "Khối lượng đã sử dụng"} tháng 1–{closed} ({amountUnit})<input className={field} inputMode="decimal" value={used} onChange={e => setUsed(e.target.value)} /></label>
      <label className="grid gap-2 font-semibold">{baseName} tháng 1–{closed} ({baseUnit})<input className={field} inputMode="decimal" value={production} onChange={e => setProduction(e.target.value)} /></label>
    </div>
    <p className="my-4 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-950">Giả định mục tiêu và cơ sở tính không đổi cả năm. {code === "NH3" ? "NH₃ đang theo điện xuất tuyến; cần xác nhận với định mức đầu cực trong sổ nguồn. " : ""}{code === "NAOH" ? "Chỉ tính dung dịch NaOH 30%, chưa quy đổi nồng độ khác. " : ""}{code === "HCL" ? "Chỉ tính dung dịch HCl 31%. " : ""}{code === "PAC" ? "Chỉ tính PAC lỏng. " : ""}Đây là hạn mức toán học, không phải nhu cầu vận hành tối thiểu. Không giảm vật tư hoặc điện dưới nhu cầu an toàn, xử lý nước và môi trường.</p>
    <h3 className="text-lg font-bold">Phân bổ các tháng còn lại</h3>
    <p className="my-2 text-sm text-slate-600">Nhập 0 nếu tháng đó không có sản lượng. Để trống lượng sử dụng dự kiến để dùng phân bổ theo sản lượng; nhập số, kể cả 0, để thử phương án riêng. Hạn mức từng tháng là gợi ý, có thể chuyển giữa các tháng nếu tổng năm vẫn đạt.</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{months.slice(closed).map((row, offset) => { const index = closed + offset; const computed = result?.months[offset]; return <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-4"><h4 className="mb-3 font-bold">Tháng {index + 1}/{year}</h4><label className="grid gap-2 text-sm font-semibold">{baseName} dự kiến ({baseUnit})<input aria-label={`${baseName} tháng ${index + 1}`} className={field} inputMode="decimal" value={row.production} onChange={e => updateMonth(index, "production", e.target.value)} /></label><p className="my-3 font-semibold text-[#0f5960]">Phân bổ: {computed && result?.feasible ? fmt(computed.allowance) + " " + amountUnit : "—"}</p><label className="grid gap-2 text-sm font-semibold">Sử dụng dự kiến ({amountUnit})<input aria-label={`Sử dụng dự kiến tháng ${index + 1}`} className={field} inputMode="decimal" placeholder="Theo phân bổ" value={row.usage} onChange={e => updateMonth(index, "usage", e.target.value)} /></label>{computed && <p className="mt-2 text-sm">Đang tính: {fmt(computed.planned)} {amountUnit}</p>}</div>; })}</div>
    {closed === 12 && <p className="my-3">Đã chốt tháng 12: chỉ đánh giá cả năm, không còn tháng để phân bổ.</p>}
    {!result && <p role="status" className="mt-4 rounded-lg bg-slate-100 p-4">Chưa có kết quả. Nhập đủ số liệu lũy kế và sản lượng từng tháng còn lại. {issue}</p>}
    {result && <div className="mt-5 space-y-4" aria-live="polite">
      <div className={`rounded-lg p-4 font-semibold ${result.achieved ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`}>{!result.feasible ? "Không còn dư địa: lượng đã sử dụng vượt hạn mức của cả năm dự kiến, kể cả không sử dụng thêm." : result.achieved ? "Dự báo đạt mục tiêu năm nếu thực hiện đúng sản lượng và lượng sử dụng này." : "Phương án đang vượt mục tiêu năm; cần điều chỉnh lượng dự kiến hoặc xem lại dự báo sản lượng."}</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Suất hao lũy kế hiện tại", fmt(result.currentRate, 6) + " " + metric.unit], ["Hạn mức sử dụng cả năm", fmt(result.annualAllowance) + " " + amountUnit], ["Còn được sử dụng", result.feasible ? fmt(result.remaining) + " " + amountUnit : "Đã vượt " + fmt(-result.remaining) + " " + amountUnit], ["Dự báo chỉ tiêu cuối năm", fmt(result.projectedRate, 6) + " " + metric.unit]].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 p-4"><p className="text-sm text-slate-600">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></div>)}</div>
      <p>Tổng sử dụng dự kiến các tháng còn lại: <strong>{fmt(result.plannedRemaining)} {amountUnit}</strong>. {result.balance >= 0 ? "Dư địa còn lại: " : "Vượt ngân sách sử dụng: "}<strong>{fmt(Math.abs(result.balance))} {amountUnit}</strong>.</p>
      {result.futureProduction === 0 && <p className="text-amber-900">Không có sản lượng bổ sung: không phân bổ theo sản lượng. Có thể nhập riêng nhu cầu sử dụng khi dừng máy để đánh giá.</p>}
      <p className="text-sm leading-6 text-slate-600">Cách tính: hạn mức năm = mục tiêu × ({fmt(numberInput(production))} + {fmt(result.futureProduction)}) / {electricity ? "100" : "1.000"}; hạn mức còn lại = hạn mức năm − lượng đã dùng. Phân bổ theo tỷ trọng sản lượng, làm tròn xuống đến 0,001 {amountUnit}. Chỉ tiêu năm tính từ tổng lượng / tổng sản lượng, không trung bình các tỷ lệ tháng.</p>
    </div>}
  </section>;
}
