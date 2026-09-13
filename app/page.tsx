"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { metrics, validateMeasurement } from "../lib/metrics";
import { AnnualPlanner } from "../components/annual-planner";

type Row = { id: number; metricCode: string; period: string; actual: string; limitValue: string; note: string; createdAt: string };
const format = (v: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(v);
const box = "rounded-xl border border-[#cbd9dc] bg-white p-5 shadow-sm";
const control = "w-full rounded-lg border border-[#9ab2b8] bg-white p-3 font-normal";
const button = "rounded-lg bg-[#123c47] px-5 py-3 font-semibold text-white disabled:opacity-50";

export default function Home() {
  const [period, setPeriod] = useState(() => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).format(new Date()));
  const [code, setCode] = useState<string>("TUDUNG");
  const [mass, setMass] = useState("");
  const [denominator, setDenominator] = useState("");
  const [gross, setGross] = useState("");
  const [exported, setExported] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const lock = useRef(false);
  const selected = metrics.find(m => m.code === code)!;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setRows([]); setError(""); setMessage("");
    fetch("/api/measurements?period=" + encodeURIComponent(period), { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        const body = await response.json() as { error?: string; measurements: Row[]; truncated?: boolean };
        if (!response.ok) throw new Error(body.error || "Không tải được số liệu.");
        if (!controller.signal.aborted) { setRows(body.measurements); if (body.truncated) setMessage("Đang hiển thị 1.000 lần ghi gần nhất của kỳ này."); }
      }).catch(e => { if (!controller.signal.aborted) setError(e.message || "Không kết nối được kho dữ liệu."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [period, reload]);
  const latest = useMemo(() => {
    const result = new Map<string, Row>();
    for (const row of rows) if (!result.has(row.metricCode)) result.set(row.metricCode, row);
    return result;
  }, [rows]);
  const exceeded = [...latest.values()].filter(r => Number(r.actual) > Number(r.limitValue)).length;
  let preview = "";
  try { preview = format(Number(validateMeasurement({ metricCode: code, period, mass, denominator, gross, exported, note }).actual)) + " " + selected.unit; } catch { /* Incomplete draft is not a result. */ }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    setError(""); setMessage("");
    const payload = { metricCode: code, period, mass, denominator, gross, exported, note };
    try { validateMeasurement(payload); } catch (e) { setError(e instanceof Error ? e.message : "Kiểm tra dữ liệu nhập."); return; }
    lock.current = true; setSaving(true);
    try {
      const response = await fetch("/api/measurements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json() as { error?: string; measurement: Row };
      if (!response.ok) throw new Error(body.error || "Chưa lưu được số liệu.");
      setRows(previous => [body.measurement, ...previous]);
      setMessage("Đã lưu vào kho dữ liệu. Lần ghi mới nhất được dùng cho bảng tổng quan; các lần cũ được giữ trong lịch sử.");
    } catch (e) { setError(e instanceof Error ? e.message : "Không nhận được xác nhận lưu. Hãy tải lại dữ liệu để kiểm tra trước khi gửi lại."); }
    finally { setSaving(false); lock.current = false; }
  }

  return <main className="min-h-screen bg-[#edf3f4] text-[#15252a]">
    <header className="bg-[#123c47] px-5 py-6 text-white"><div className="mx-auto max-w-7xl"><p className="text-sm font-semibold text-[#aee0df]">PXVH1 · BẢN KIỂM THỬ</p><h1 className="mt-1 text-2xl font-bold">Chỉ tiêu kinh tế kỹ thuật</h1></div></header>
    <div className="mx-auto max-w-7xl space-y-5 p-5">
      <AnnualPlanner />
      <div className="flex flex-wrap items-end justify-between gap-4"><label className="grid gap-2 font-semibold">Kỳ theo dõi<input aria-label="Kỳ theo dõi" type="month" min="1900-01" max="2199-12" disabled={saving} value={period} onChange={e => setPeriod(e.target.value)} className={control} /></label><button className={button} disabled={saving || loading} onClick={() => setReload(v => v + 1)}>Tải lại dữ liệu</button></div>
      <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm leading-6">Định mức tham khảo từ sổ PXVH1, chưa xác nhận kỳ hiệu lực và người phê duyệt. Cảnh báo chỉ phục vụ kiểm thử, chưa dùng để kết luận vận hành. Không có số liệu mẫu trong kết quả.</p>
      {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">{error}</p>}
      {message && <p role="status" className="rounded-lg bg-blue-50 p-4 text-blue-900">{message}</p>}
      <div className="grid gap-4 sm:grid-cols-3">{[["Đạt ngưỡng tham khảo", latest.size - exceeded], ["Vượt ngưỡng tham khảo", exceeded], ["Chưa có số liệu", metrics.length - latest.size]].map(([label, value]) => <div key={label} className={box}><p className="text-sm">{label}</p><p className="mt-2 text-3xl font-bold">{loading ? "…" : value}</p></div>)}</div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <section className={box}><h2 className="text-xl font-bold">Kết quả kỳ {period}</h2><p className="mb-4 mt-1 text-sm text-slate-600">Thanh đo: thực tế / định mức; vạch giữa là 100%. Giá trị trên 200% được ghi bằng số.</p>
          {loading ? <p role="status">Đang tải số liệu…</p> : <div className="divide-y">{metrics.map(metric => {
            const row = latest.get(metric.code);
            const value = row ? Number(row.actual) : null;
            const limit = row ? Number(row.limitValue) : metric.limit;
            const ratio = value === null ? null : value / limit * 100;
            const over = ratio !== null && ratio > 100;
            return <article key={metric.code} className="py-4">
              <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{metric.name}</h3><span className={value === null ? "text-slate-500" : over ? "font-bold text-red-700" : "font-bold text-emerald-800"}>{value === null ? "Chưa có số liệu" : over ? "Vượt ngưỡng" : "Đạt ngưỡng"}</span></div>
              <p className="my-2 text-sm">{value === null ? "—" : format(value)} / {format(limit)} {metric.unit}{ratio !== null && <span> · {format(ratio)}% định mức</span>}</p>
              <div className="relative h-3 rounded bg-slate-100" aria-hidden="true"><div className={over ? "h-full rounded bg-red-600" : "h-full rounded bg-emerald-600"} style={{ width: (ratio === null ? 0 : Math.min(ratio, 200) / 2) + "%" }} /><span className="absolute left-1/2 top-[-3px] h-5 border-l-2 border-slate-700" /></div>
            </article>;
          })}</div>}
        </section>
        <section className={box}><h2 className="text-xl font-bold">Nhập số liệu</h2><form className="mt-4 space-y-4" onSubmit={submit}><fieldset disabled={saving} className="space-y-4">
          <label className="grid gap-2 font-semibold">Chỉ tiêu<select className={control} value={code} onChange={e => { setCode(e.target.value); setMass(""); setDenominator(""); setGross(""); setExported(""); setMessage(""); }}>{metrics.map(m => <option key={m.code} value={m.code}>{m.name}</option>)}</select></label>
          {code === "TUDUNG" ? <>
            <p className="rounded-lg bg-slate-50 p-3 text-sm leading-6">Tự tính = (điện sản xuất − điện giao nhận) / điện sản xuất × 100. Nhập tổng hai tổ máy trong cùng kỳ, cùng đơn vị kWh theo cơ sở bảng theo dõi.</p>
            <label className="grid gap-2 font-semibold">Điện sản xuất (kWh)<input required inputMode="decimal" className={control} value={gross} onChange={e => setGross(e.target.value)} /></label>
            <label className="grid gap-2 font-semibold">Điện giao nhận (kWh)<input required inputMode="decimal" className={control} value={exported} onChange={e => setExported(e.target.value)} /></label>
          </> : <>
            <p className="rounded-lg bg-slate-50 p-3 text-sm leading-6">Tự tính = khối lượng (kg) × 1.000 / {code === "BI_NGHIEN" ? "than tiêu thụ (tấn)" : "điện xuất tuyến (kWh)"}. Nhập tổng lượng sử dụng trong cùng kỳ, không nhập lượng tồn kho.</p>
            {code === "NH3" && <p className="text-sm text-amber-900">Sổ cảnh báo dùng suất hao xuất tuyến, nhưng dòng định mức trong sổ theo dõi ghi đầu cực. Cần xác nhận cơ sở so sánh trước khi áp dụng chính thức.</p>}
            {code === "NAOH" && <p className="text-sm text-amber-900">Nhập khối lượng dung dịch NaOH 30%. Chưa tự quy đổi dung dịch nồng độ khác.</p>}
            {code === "HCL" && <p className="text-sm text-amber-900">Nhập khối lượng dung dịch HCl 31% một lần, không cộng trùng các tên chỉ khác chữ hoa/thường.</p>}
            {code === "PAC" && <p className="text-sm text-amber-900">Phiên bản này theo cơ sở PAC lỏng trong công thức nguồn, không cộng PAC bột.</p>}
            <label className="grid gap-2 font-semibold">Khối lượng sử dụng (kg)<input required inputMode="decimal" className={control} value={mass} onChange={e => setMass(e.target.value)} /></label>
            <label className="grid gap-2 font-semibold">{code === "BI_NGHIEN" ? "Than tiêu thụ (tấn)" : "Điện xuất tuyến (kWh)"}<input required inputMode="decimal" className={control} value={denominator} onChange={e => setDenominator(e.target.value)} /></label>
          </>}
          <label className="grid gap-2 font-semibold">Ghi chú<textarea maxLength={1000} rows={3} className={control} value={note} onChange={e => setNote(e.target.value)} /></label>
          <p className="text-sm text-slate-600">Không dùng dấu phân cách hàng nghìn. Ví dụ: 1250,5.</p>
          <p className="rounded-lg bg-[#e3f0ef] p-3 font-semibold" aria-live="polite">Xem trước, chưa lưu: {preview || "chưa đủ dữ liệu hợp lệ"}</p>
          <button className={button + " w-full"} disabled={loading} type="submit">{saving ? "Đang lưu…" : "Lưu số liệu kỳ " + period}</button>
        </fieldset></form></section>
      </div>
      <section className={box}><h2 className="text-xl font-bold">Lịch sử ghi nhận · {period}</h2><p className="mt-1 text-sm text-slate-600">Mỗi lần lưu tạo một bản ghi mới, không xóa lần cũ. Thời gian lưu hiển thị theo giờ Việt Nam.</p>
        {!loading && rows.length === 0 && <p className="mt-4">Chưa tải được bản ghi nào trong kỳ này.</p>}
        <div className="mt-4 max-h-96 space-y-3 overflow-y-auto">{rows.map(row => <article key={row.id} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{metrics.find(m => m.code === row.metricCode)?.name || row.metricCode}: {format(Number(row.actual))} {metrics.find(m => m.code === row.metricCode)?.unit}</p><time className="text-sm text-slate-600">{new Date(row.createdAt.replace(" ", "T") + "Z").toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</time></div><p className="mt-1 break-words whitespace-pre-wrap text-sm">{row.note || "Không có ghi chú"}</p></article>)}</div>
      </section>
    </div>
  </main>;
}
