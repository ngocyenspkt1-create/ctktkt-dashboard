import Link from "next/link";
import type { ReactNode } from "react";
import { KeyRound } from "lucide-react";
import { getSessionUser } from "@/lib/auth/server";
import { isAdminUser, ROLE_LABELS } from "@/lib/auth/session";
import { navItemFor } from "@/lib/navigation";
import { SessionProvider } from "@/components/session-context";
import { LogoutButton } from "@/components/logout-button";
import { MobileNav, QuickSearch, SidebarNav } from "@/components/app-navigation";

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-600 to-sky-500 text-sm font-bold text-white shadow-sm shadow-indigo-500/30">VH1</span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold text-slate-900">Vận hành 1</span>
        <span className="block text-[11px] text-slate-500">NMNĐ Duyên Hải 1</span>
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
      <div className="min-h-screen bg-[var(--app-bg)] text-slate-900">
        <aside className="app-sidebar fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200/80 bg-white lg:flex">
          <div className="flex h-16 items-center border-b border-slate-100 px-5"><Brand /></div>
          <div className="flex-1 overflow-y-auto px-3 py-5">
            <SidebarNav active={active} isAdmin={isAdmin} />
          </div>
          <div className="border-t border-slate-100 p-3">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">{initials}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{user.displayName}</p>
                <p className="truncate text-[11px] text-slate-500" title={roleLabel}>{roleLabel}</p>
              </div>
              <Link href="/doi-mat-khau" title="Đổi mật khẩu" aria-label="Đổi mật khẩu" className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-700">
                <KeyRound className="size-4" aria-hidden />
              </Link>
              <LogoutButton />
            </div>
          </div>
        </aside>

        <div className="lg:pl-64">
          <header className="app-header sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/70 sm:px-6">
            <MobileNav active={active} isAdmin={isAdmin} brand={<Brand />} />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">{current?.label ?? "Vận hành 1"}</h1>
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
          <main className="px-3 py-4 sm:px-5 lg:px-6 lg:py-6">{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}
