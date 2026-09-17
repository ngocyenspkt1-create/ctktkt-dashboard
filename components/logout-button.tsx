"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" onClick={() => void logout()} disabled={loading} title="Đăng xuất" className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-60">
      ⏻
    </button>
  );
}
