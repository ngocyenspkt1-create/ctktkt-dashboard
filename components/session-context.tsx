"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "@/lib/auth/session";

const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSessionUser(): SessionUser {
  const user = useContext(SessionContext);
  if (!user) throw new Error("useSessionUser() phải được gọi bên trong SessionProvider.");
  return user;
}
