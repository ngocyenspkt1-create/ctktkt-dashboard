import Link from "next/link";
import type { ReactNode } from "react";

const navigation = [
  { icon: "⌂", label: "Tổng quan", href: "/", key: "overview" },
  { icon: "▦", label: "Dữ liệu các tháng", href: "/", key: "data" },
  { icon: "◎", label: "Định mức chỉ tiêu", href: "/", key: "limits" },
  { icon: "≋", label: "So sánh SHN PPA & thực tế", href: "/ppa-heat-rate", key: "ppa" },
  { icon: "!", label: "Cảnh báo bất thường", href: "/", key: "alerts" },
  { icon: "▤", label: "Báo cáo tổng hợp", href: "/", key: "reports" },
];

export function AppShell({ children, active }: { children: ReactNode; active: string }) {
  return <main className="flex min-h-screen bg-[#f5f6f8] text-[#17213b]">
    <aside className="sticky top-0 hidden h-screen w-[235px] shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="m-3 rounded-2xl bg-gradient-to-br from-[#314793] via-[#4369b5] to-[#8c9272] px-4 py-4 text-white shadow-md"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-xl text-[#3b4f9c]">✦</span><div><p className="text-base font-extrabold tracking-wide">VẬN HÀNH 1</p><p className="text-[10px] font-semibold tracking-[0.16em] text-blue-100">DIGITAL OPERATIONS</p></div></div></div>
      <nav className="mt-2 flex-1 px-2"><p className="px-3 py-2 text-[10px] font-extrabold tracking-[0.16em] text-slate-400">QUẢN LÝ CHỈ TIÊU</p>{navigation.map(item => {
        const selected = item.key === active;
        return <Link key={item.key} href={item.href} className={`mb-1 flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold ${selected ? "bg-[#eef2ff] text-[#35499d] shadow-sm ring-1 ring-[#dce3ff]" : "text-slate-600 hover:bg-slate-50"}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border text-sm ${selected ? "border-[#6579d6] bg-[#5268c4] text-white" : "border-slate-200 bg-white text-slate-500"}`}>{item.icon}</span><span className="leading-4">{item.label}</span></Link>;
      })}</nav>
      <div className="border-t p-4"><p className="text-xs font-semibold text-slate-500">© 2026 · Phân xưởng Vận hành 1</p><div className="mt-3 rounded-xl border bg-[#f8faff] px-3 py-2 text-center text-xs font-bold text-[#4057a8]">Hệ thống nội bộ</div></div>
    </aside>
    <div className="min-w-0 flex-1">
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm"><div className="flex items-center gap-3"><button aria-label="Mở trình đơn" className="grid h-9 w-9 place-items-center rounded-xl bg-[#56b792] text-lg font-bold text-white">≡</button><label className="hidden h-9 w-[300px] items-center gap-2 rounded-xl border border-slate-200 bg-[#fafbfc] px-3 text-sm text-slate-400 sm:flex"><span>⌕</span><input aria-label="Tìm kiếm chức năng" placeholder="Tìm kiếm chức năng, chỉ tiêu…" className="min-w-0 flex-1 bg-transparent outline-none"/></label></div><div className="flex items-center gap-2"><span className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">● Kho dữ liệu hoạt động</span><div className="hidden border-l pl-3 text-right sm:block"><p className="text-sm font-extrabold">PXVH1</p><p className="text-[10px] font-semibold text-slate-500">NGƯỜI VẬN HÀNH</p></div><span className="grid h-9 w-9 place-items-center rounded-full bg-[#e9edf8] font-extrabold text-[#3c4f99]">VH</span></div></header>
      <div className="p-3 lg:p-4">{children}</div>
    </div>
  </main>;
}
