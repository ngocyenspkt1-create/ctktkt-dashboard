"use client";

import { useEffect, useMemo, useState } from "react";
import { Beaker, CalendarDays, CheckCircle2, LockKeyhole, Save } from "lucide-react";
import { useSessionUser } from "@/components/session-context";
import { editableChemicalsFor, type ChemicalCatalogItem, type ChemicalCode } from "@/lib/chemical-usage/catalog";
import { defaultOperatingDate } from "@/lib/operating-date";

type ChemicalRecord = {
  id: number;
  usage_date: string;
  chemical_code: ChemicalCode;
  material_code: string;
  chemical_name: string;
  unit: string;
  quantity: number;
  purpose: string;
  plant_unit: string;
  reference: string;
  entered_by_name: string;
  entered_by_position: string;
};

function currentMonth() {
  return defaultOperatingDate().slice(0, 7);
}

function formatNumber(value: number) {
  return Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 4 });
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function ChemicalUsageClient() {
  const user = useSessionUser();
  const allowedCatalog = useMemo(() => editableChemicalsFor(user), [user]);
  const [month, setMonth] = useState(currentMonth);
  const [records, setRecords] = useState<ChemicalRecord[]>([]);
  const [catalog, setCatalog] = useState<readonly ChemicalCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [usageDate, setUsageDate] = useState(defaultOperatingDate);
  const [chemicalCode, setChemicalCode] = useState<string>(allowedCatalog[0]?.code || "");
  const [quantity, setQuantity] = useState("");
  const [reasonChoice, setReasonChoice] = useState<string>(allowedCatalog[0]?.suggestedReasons[0] || "");
  const [otherReason, setOtherReason] = useState("");
  const [reference, setReference] = useState("");

  async function fetchMonth(targetMonth: string) {
    try {
      const response = await fetch(`/api/chemical-usage?month=${targetMonth}`, { cache: "no-store" });
      const data = await response.json() as { error?: string; records?: ChemicalRecord[]; catalog?: ChemicalCatalogItem[] };
      if (!response.ok) throw new Error(data.error || "Không thể tải dữ liệu.");
      setRecords(data.records || []);
      setCatalog(data.catalog || []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  }

  const [trackedMonth, setTrackedMonth] = useState(month);
  if (trackedMonth !== month) {
    setTrackedMonth(month);
    setLoading(true);
    setError("");
  }

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/chemical-usage?month=${month}`, { cache: "no-store" })
      .then(async response => ({
        response,
        data: await response.json() as { error?: string; records?: ChemicalRecord[]; catalog?: ChemicalCatalogItem[] },
      }))
      .then(({ response, data }) => {
        if (cancelled) return;
        if (!response.ok) throw new Error(data.error || "Không thể tải dữ liệu.");
        setRecords(data.records || []);
        setCatalog(data.catalog || []);
      })
      .catch(caught => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Không thể tải dữ liệu.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [month]);

  const totals = useMemo(() => {
    const result = new Map<string, number>();
    for (const record of records) {
      result.set(record.chemical_code, (result.get(record.chemical_code) || 0) + Number(record.quantity || 0));
    }
    return result;
  }, [records]);

  async function saveRecord(event: React.FormEvent) {
    event.preventDefault();
    const purpose = reasonChoice === "__other__" ? otherReason.trim() : reasonChoice;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/chemical-usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usageDate,
          chemicalCode,
          quantity: Number(quantity.replace(",", ".")),
          purpose,
          reference,
        }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Không thể lưu dữ liệu.");
      setSuccess("Đã lưu lượng hóa chất và thông tin người nhập.");
      setQuantity("");
      setOtherReason("");
      setReference("");
      const targetMonth = usageDate.slice(0, 7);
      if (targetMonth !== month) setMonth(targetMonth);
      else await fetchMonth(month);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể lưu dữ liệu.");
    } finally {
      setSaving(false);
    }
  }

  const selectedChemical = allowedCatalog.find(item => item.code === chemicalCode);

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <Beaker className="size-4" aria-hidden /> Theo dõi theo ngày
            </div>
            <h2 className="text-xl font-bold text-slate-900">Hóa chất XLN, Polishing</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Danh mục và quyền nhập được xây dựng từ cột “Cương vị” của sheet nguồn. Mỗi lần lưu tự ghi nhận tài khoản và cương vị để truy vết.
            </p>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <CalendarDays className="size-4 text-slate-500" aria-hidden />
            <span className="font-medium text-slate-600">Tháng xem</span>
            <input type="month" value={month} onChange={event => setMonth(event.target.value)} className="rounded-md border border-slate-200 bg-white px-2 py-1 outline-none focus:border-emerald-400" />
          </label>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {catalog.map(item => (
          <article key={item.code} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">{item.name}</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{formatNumber(totals.get(item.code) || 0)} <span className="text-sm font-medium text-slate-500">{item.unit}</span></p>
            <p className="mt-2 text-xs leading-5 text-slate-500">Nhập: {item.allowedPositions.join(" · ")}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900">Nhập lượng sử dụng</h3>
          <p className="mt-1 text-sm text-slate-500">Cương vị hiện tại: <strong>{user.position || "Chưa xác định"}</strong></p>

          {allowedCatalog.length === 0 ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <div className="flex items-center gap-2 font-semibold"><LockKeyhole className="size-4" /> Chế độ chỉ xem</div>
              <p className="mt-1">Cương vị của bạn không có hóa chất được phép nhập theo sheet nguồn.</p>
            </div>
          ) : (
            <form onSubmit={saveRecord} className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-slate-700">Ngày thực hiện
                <input required type="date" value={usageDate} onChange={event => setUsageDate(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
              </label>
              <label className="block text-sm font-medium text-slate-700">Loại hóa chất
                <select required value={chemicalCode} onChange={event => {
                  const nextCode = event.target.value;
                  const nextChemical = allowedCatalog.find(item => item.code === nextCode);
                  setChemicalCode(nextCode);
                  setReasonChoice(nextChemical?.suggestedReasons[0] || "");
                  setOtherReason("");
                }} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-emerald-400">
                  {allowedCatalog.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
                </select>
                {selectedChemical && <span className="mt-1 block text-xs text-slate-400">Mã vật tư: {selectedChemical.materialCode}</span>}
              </label>
              <label className="block text-sm font-medium text-slate-700">Số lượng ({selectedChemical?.unit || "Tấn"})
                <input required inputMode="decimal" value={quantity} onChange={event => setQuantity(event.target.value)} placeholder="0,000" className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-emerald-400" />
              </label>
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
                Tổ máy: <strong>Chung</strong> — áp dụng cho toàn bộ hóa chất trong danh mục.
              </div>
              <label className="block text-sm font-medium text-slate-700">Nội dung công tác/lý do sử dụng
                <select required value={reasonChoice} onChange={event => setReasonChoice(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 outline-none focus:border-emerald-400">
                  {selectedChemical?.suggestedReasons.map(reason => <option key={reason} value={reason}>{reason}</option>)}
                  <option value="__other__">Lý do khác…</option>
                </select>
              </label>
              {reasonChoice === "__other__" && (
                <label className="block text-sm font-medium text-slate-700">Ghi rõ lý do khác
                  <textarea required value={otherReason} onChange={event => setOtherReason(event.target.value)} rows={3} maxLength={500} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-emerald-400" />
                </label>
              )}
              <label className="block text-sm font-medium text-slate-700">Tham chiếu/đính kèm (nếu có)
                <input value={reference} onChange={event => setReference(event.target.value)} maxLength={300} placeholder="Số PCT/LCT hoặc tên hồ sơ" className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 outline-none focus:border-emerald-400" />
              </label>
              <button disabled={saving} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                <Save className="size-4" aria-hidden /> {saving ? "Đang lưu…" : "Lưu hóa chất trong ngày"}
              </button>
            </form>
          )}
          {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {success && <p className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 className="size-4" />{success}</p>}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="font-semibold text-slate-900">Nhật ký tháng {month.slice(5, 7)}/{month.slice(0, 4)}</h3>
            <p className="mt-1 text-sm text-slate-500">{records.length} lượt sử dụng đã ghi nhận</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1050px] w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Ngày</th><th className="px-4 py-3">Hóa chất</th><th className="px-4 py-3 text-right">Số lượng</th><th className="px-4 py-3">Tổ máy</th><th className="px-4 py-3">Nội dung/lý do</th><th className="px-4 py-3">Người nhập</th><th className="px-4 py-3">Tham chiếu</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Đang tải dữ liệu…</td></tr> : null}
                {!loading && records.length === 0 ? <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Chưa có dữ liệu trong tháng này.</td></tr> : null}
                {!loading && records.map(record => (
                  <tr key={record.id} className="align-top hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">{formatDate(record.usage_date)}</td>
                    <td className="px-4 py-3"><span className="font-semibold text-slate-900">{record.chemical_name}</span><span className="block text-xs text-slate-400">{record.material_code}</span></td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold text-emerald-700">{formatNumber(record.quantity)} {record.unit}</td>
                    <td className="px-4 py-3 text-slate-600">{record.plant_unit}</td>
                    <td className="max-w-xs px-4 py-3 text-slate-600">{record.purpose}</td>
                    <td className="px-4 py-3"><span className="text-slate-800">{record.entered_by_name}</span><span className="block text-xs text-slate-400">{record.entered_by_position}</span></td>
                    <td className="max-w-48 px-4 py-3 text-slate-500">{record.reference || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
