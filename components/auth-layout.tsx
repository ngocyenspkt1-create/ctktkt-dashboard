import type { ReactNode } from "react";
import { BarChart3, ClipboardList, Flame, ShieldCheck } from "lucide-react";

const HIGHLIGHTS = [
  { icon: ClipboardList, text: "Nhập liệu theo cương vị, dán trực tiếp từ Excel" },
  { icon: Flame, text: "Tự tính suất hao nhiệt, than quy ẩm, NH3, nước demin" },
  { icon: BarChart3, text: "Xuất Chỉ tiêu KTKT, BCSX A0/S1/S2 đúng mẫu gốc" },
  { icon: ShieldCheck, text: "Phân quyền theo cương vị, dữ liệu nội bộ" },
];

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-screen bg-[var(--app-bg)] lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-sky-500 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="absolute -top-24 -right-24 size-96 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="absolute -bottom-32 -left-20 size-96 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-white/15 text-sm font-bold ring-1 ring-white/30">VH1</span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Phân xưởng Vận hành 1</p>
            <p className="text-xs text-indigo-100">NMNĐ Duyên Hải 1</p>
          </div>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">Quản lý chỉ tiêu kinh tế kỹ thuật</h2>
          <p className="mt-3 text-sm leading-6 text-indigo-100">Một nơi cho số liệu vận hành hằng ngày, báo cáo và đối chiếu với QLKT, PMIS.</p>
          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-indigo-50">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/15 ring-1 ring-white/20"><Icon className="size-4" aria-hidden /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-indigo-100/80">© 2026 · Hệ thống nội bộ</p>
      </section>
      <section className="flex items-center justify-center p-4 sm:p-8">{children}</section>
    </main>
  );
}

export const authInputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100";
export const authButtonClass =
  "h-11 w-full rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm shadow-indigo-600/25 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60";
