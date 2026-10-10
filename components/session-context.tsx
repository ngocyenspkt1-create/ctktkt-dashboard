"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { hasPermission, type Permission, type SessionUser } from "@/lib/auth/session";

const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState(user);
  useEffect(() => { setCurrentUser(user); }, [user]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        if (!active) return;
        if (response.status === 401) { window.location.assign("/login"); return; }
        if (!response.ok) return;
        const data = await response.json() as { user: SessionUser };
        if (data.user.mustChangePassword) { window.location.assign("/doi-mat-khau"); return; }
        setCurrentUser(data.user);
      } catch { /* Server still enforces current grants if refresh is temporarily unavailable. */ }
    };
    const timer = window.setInterval(() => void refresh(), 60_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("permissions-updated", onFocus);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); window.removeEventListener("permissions-updated", onFocus); };
  }, []);
  return <SessionContext.Provider value={currentUser}>{children}</SessionContext.Provider>;
}

export function useSessionUser(): SessionUser {
  const user = useContext(SessionContext);
  if (!user) throw new Error("useSessionUser() phải được gọi bên trong SessionProvider.");
  return user;
}

export function useHasPermission(permission: Permission): boolean {
  const user = useContext(SessionContext);
  return hasPermission(user, permission);
}
