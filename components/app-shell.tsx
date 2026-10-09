import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, KeyRound, Zap } from "lucide-react";
import { getSessionUser } from "@/lib/auth/server";
import { isAdminUser, ROLE_LABELS } from "@/lib/auth/session";
import { navItemFor } from "@/lib/navigation";
import { SessionProvider } from "@/components/session-context";
import { LogoutButton } from "@/components/logout-button";
import { MobileNav, QuickSearch, SidebarNav } from "@/components/app-navigation";

function Brand() {
  return (
    <Link href="/" className="app-brand flex items-center gap-3">
      <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-blue-900/20"><Zap className="size-5" aria-hidden /></span>
      <span className="leading-tight">
        <span className="app-brand-title block text-base font-bold">Vận hành 1</span>
        <span className="app-brand-subtitle block text-xs">NMNĐ Duyên Hải 1</span>
      </span>
    </Link>
  );
}

// AppShell là Server Component: tự đọc phiên đăng nhập qua cookie (proxy.ts đã chặn người chưa đăng nhập)
// và bọc nội dung trong SessionProvider để các component con biết quyền hiện tại.
export async function AppShell({ children, active }: { children: ReactNode; active: string; hideSearch?: boolean }) {
  const user = await getSessionUser();
  if (!user) return null;
  const isAdmin = isAdminUser(user);
  const current = navItemFor(active);
  const initials = user.displayName.trim().split(/\s+/).slice(-2).map(part => part[0]).join("").toUpperCase() || "??";
  const roleLabel = user.position ? `${user.position} · ${ROLE_LABELS[user.role] || user.role}` : ROLE_LABELS[user.role];

  return (
    <SessionProvider user={user}>
      <div className="app-workspace min-h-screen bg-[var(--app-bg)] text-slate-900">
        <aside className="app-sidebar fixed inset-y-0 left-0 z-30 hidden w-64 flex-col lg:flex">
          <div className="app-sidebar-brand flex h-20 items-center px-5"><Brand /></div>
          <div className="flex-1 overflow-y-auto px-3 py-5">
            <SidebarNav active={active} isAdmin={isAdmin} />
          </div>
          <div className="app-sidebar-footer p-3">
            <p className="mb-3 px-2 text-xs text-slate-400">PXVH1 · Quản lý chỉ tiêu KTKT</p>
            <div className="app-user-card flex items-center gap-2 rounded-xl p-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">{initials}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-100">{user.displayName}</p>
                <p className="truncate text-[11px] text-slate-300" title={roleLabel}>{roleLabel}</p>
              </div>
              <Link href="/doi-mat-khau" title="Đổi mật khẩu" aria-label="Đổi mật khẩu" className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-700">
                <KeyRound className="size-4" aria-hidden />
              </Link>
              <LogoutButton />
            </div>
          </div>
        </aside>

        <div className="lg:pl-64">
          <header className="app-header sticky top-0 z-20 flex h-20 items-center gap-3 border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur sm:px-6">
            <MobileNav active={active} isAdmin={isAdmin} brand={<Brand />} />
            <div className="min-w-0 flex-1">
              <p className="mb-0.5 hidden items-center gap-1.5 text-[11px] text-slate-500 sm:flex"><span>Duyên Hải 1</span><ChevronRight className="size-3" aria-hidden /><span className="text-blue-700">Vận hành 1</span></p>
              <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">{current?.label ?? "Vận hành 1"}</h1>
              {current && <p className="hidden truncate text-xs text-slate-500 sm:block">{current.description}</p>}
            </div>
            <QuickSearch isAdmin={isAdmin} />
            <div className="flex items-center gap-1 lg:hidden">
              <Link href="/doi-mat-khau" title="Đổi mật khẩu" aria-label="Đổi mật khẩu" className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100">
                <KeyRound className="size-4" aria-hidden />
              </Link>
              <LogoutButton />
            </div>
          </header>
          <main className={`app-content ${active !== "data" ? "engineering-workspace" : ""} px-3 py-4 sm:px-5 lg:px-6 lg:py-6`} data-module={active}>{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}
