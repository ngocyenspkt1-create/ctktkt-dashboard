"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(""); setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const body = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error || "Đăng nhập không thành công.");
      const next = searchParams.get("next");
      router.replace(next && next.startsWith("/") ? next : "/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Đăng nhập không thành công.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid w-full max-w-sm gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
      <div>
        <h1 className="text-lg font-extrabold text-[#173b64]">Đăng nhập</h1>
        <p className="mt-1 text-sm text-slate-500">Quản lý chỉ tiêu KTKT PXVH1</p>
      </div>
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        Tên đăng nhập
        <input value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" autoFocus required className="rounded-xl border border-slate-300 px-3 py-2 font-normal text-black"/>
      </label>
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        Mật khẩu
        <input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required className="rounded-xl border border-slate-300 px-3 py-2 font-normal text-black"/>
      </label>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold leading-5 text-red-700">{error}</p>}
      <button type="submit" disabled={loading} className="rounded-xl bg-[#334785] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{loading ? "Đang đăng nhập…" : "Đăng nhập"}</button>
    </form>
  );
}
