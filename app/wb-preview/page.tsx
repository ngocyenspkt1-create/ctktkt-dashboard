import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, CheckCircle2, Database, PencilLine, Save, TriangleAlert, Zap } from "lucide-react";
import { visibleGroups } from "@/lib/navigation";
import "@/components/daily-production-table.css";

// Static, read-only design review. No session, business APIs or database access.
export default function WbPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  const rows = [
    ["01", "7.824,32", "7.108,64", "716,00", "9,15", "24,00"],
    ["02", "8.102,56", "7.379,12", "723,44", "8,93", "24,00"],
    ["03", "7.956,80", "7.243,28", "713,52", "8,97", "24,00"],
    ["04", "8.214,40", "7.482,56", "731,84", "8,91", "24,00"],
    ["05", "8.068,16", "7.343,04", "725,12", "8,99", "24,00"],
  ];
  return <div className="app-workspace min-h-screen text-slate-900">
    <aside className="app-sidebar fixed inset-y-0 left-0 hidden w-64 flex-col lg:flex">
      <div className="app-sidebar-brand flex h-20 items-center gap-3 px-5"><span className="control-brand-mark grid size-10 place-items-center"><Zap className="size-5" /></span><div><span className="app-brand-title block font-bold">DUYÊN HẢI 1</span><span className="app-brand-subtitle block">Phân xưởng Vận hành 1</span></div></div>
      <div className="control-workspace-label">KHÔNG GIAN LÀM VIỆC <span>PXVH1</span></div>
      <nav className="app-nav flex flex-1 flex-col gap-6 overflow-auto px-3 py-5" aria-label="Chức năng minh họa">{visibleGroups(false).map(group => <div key={group.title}><p className="app-nav-group px-3 pb-2 font-semibold uppercase">{group.title}</p><ul className="space-y-1">{group.items.map(item => <li key={item.key}><Link className="app-nav-link flex items-center gap-3" href={item.href} aria-current={item.key === "data" ? "page" : undefined}><item.icon className="size-[18px]" /><span>{item.label}</span></Link></li>)}</ul></div>)}</nav>
      <div className="app-sidebar-footer p-4 text-xs text-slate-500">Bản duyệt giao diện · /wb</div>
    </aside>
    <div className="lg:pl-64">
      <header className="app-header flex items-center justify-between gap-3 border-b px-5"><div><p className="text-[11px] text-slate-500">Duyên Hải 1 / Vận hành 1</p><h1>Dữ liệu các tháng</h1></div><Link href="/login" className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">Đăng nhập hệ thống</Link></header>
      <main className="app-content space-y-5 px-4 sm:px-6">
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">BẢN XEM TRƯỚC LOCAL — Số liệu bên dưới chỉ minh họa bố cục. Không lưu hoặc đồng bộ dữ liệu thật.</p>
        <div className="monthly-heading"><div className="monthly-heading-icon"><Database /></div><div className="flex-1"><p className="monthly-eyebrow mb-2">TỔNG QUAN VẬN HÀNH</p><h2>Dữ liệu sản xuất hằng ngày</h2><p className="mt-2">Theo dõi sản lượng, hiệu suất và các chỉ tiêu kinh tế kỹ thuật.</p></div><div className="monthly-period-badge"><CalendarDays className="size-4" />Tháng 10 / 2026</div></div>
        <div className="monthly-toolbar"><div className="monthly-toolbar-label"><p className="font-semibold">Kỳ dữ liệu & thao tác</p><p className="mt-1 text-xs text-slate-500">Chọn tháng để xem hoặc cập nhật số liệu</p></div><div className="flex flex-wrap items-center gap-3"><span className="rounded-lg border px-4 py-2 text-sm">Tháng 10, 2026</span><button disabled className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700 disabled:opacity-60">Đồng bộ dữ liệu ngày</button><button disabled className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-60"><Save className="size-4" />Lưu thay đổi</button></div></div>
        <div className="monthly-stats grid grid-cols-2 gap-3 xl:grid-cols-4">{[{icon:CalendarDays,label:"Ngày trong tháng",value:"31",tone:"bg-blue-50 text-blue-600"},{icon:CheckCircle2,label:"Ngày đã nhập",value:"05",tone:"bg-emerald-50 text-emerald-600"},{icon:PencilLine,label:"Ô vừa thay đổi",value:"0",tone:"bg-amber-50 text-amber-600"},{icon:TriangleAlert,label:"CE/CF bất thường",value:"0",tone:"bg-slate-100 text-slate-500"}].map(card => <div className="monthly-stat" key={card.label}><span className={`monthly-stat-icon ${card.tone}`}><card.icon className="size-5" /></span><div><p>{card.value}</p><p className="mt-2">{card.label}</p></div></div>)}</div>
        <section className="monthly-overview"><div className="monthly-overview-header"><div><p className="monthly-eyebrow mb-2">XU HƯỚNG THEO NGÀY</p><h2 className="font-semibold">Sản lượng điện đầu cực S1</h2></div><span className="text-xs text-slate-500">MWh · Dữ liệu minh họa</span></div><div className="wb-preview-chart"><svg viewBox="0 0 900 180" role="img" aria-label="Biểu đồ minh họa sản lượng năm ngày"><g stroke="#e8edf4" strokeDasharray="4 4"><path d="M40 25H870M40 65H870M40 105H870M40 145H870" /></g><path d="M40 120L247 70L454 96L661 44L870 77L870 145H40Z" fill="#edf3ff" /><path d="M40 120L247 70L454 96L661 44L870 77" fill="none" stroke="#245cdb" strokeWidth="3" />{[40,247,454,661,870].map((x,i) => <text key={x} x={x} y="174" textAnchor="middle" fill="#7a8598" fontSize="12">0{i+1}/10</text>)}</svg></div></section>
        <section className="monthly-overview"><div className="monthly-table-heading"><div><h3 className="font-semibold">Chỉ tiêu kinh tế kỹ thuật</h3><p className="mt-1 text-xs">Đầu cực, điểm bán và điện tự dùng theo ngày</p></div><span className="monthly-chart-hint">Bảng minh họa · chỉ đọc</span></div><div className="overflow-x-auto"><table className="monthly-grid w-full min-w-[700px] text-right"><thead><tr>{["Ngày","Đầu cực S1 · MWh","Điểm bán S1 · MWh","Tự dùng S1 · MWh","Tỷ lệ tự dùng · %","Giờ phát S1 · giờ"].map(label => <th key={label} className="text-right">{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row[0]}>{row.map((value,i) => <td key={i} className="border-b border-slate-100 px-4 py-3">{value}</td>)}</tr>)}</tbody></table></div></section>
        <p className="pb-5 text-xs text-slate-500">Tham khảo bố cục Shadcn Admin & Tabler. Các trang nghiệp vụ vẫn yêu cầu đăng nhập.</p>
      </main>
    </div>
  </div>;
}
