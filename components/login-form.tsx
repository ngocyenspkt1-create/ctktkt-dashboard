"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authButtonClass, authInputClass } from "@/components/auth-layout";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      const body = await response.json() as { ok?: boolean; error?: string; mustChangePassword?: boolean };
      if (!response.ok || !body.ok) throw new Error(body.error || "Đăng nhập không thành công.");
      const next = searchParams.get("next");
      // Only same-site relative paths; "//host" would be an open redirect.
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      router.replace(body.mustChangePassword ? "/doi-mat-khau" : safeNext);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Đăng nhập không thành công.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm">
      <div className="mb-8">
        <span className="mb-6 grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-sky-500 text-sm font-bold text-white shadow-md shadow-indigo-500/30 lg:hidden">VH1</span>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Đăng nhập</h1>
        <p className="mt-1.5 text-sm text-slate-500">Dùng tài khoản được Quản trị cấp để tiếp tục.</p>
      </div>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Tên đăng nhập</span>
          <input value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" autoFocus required placeholder="vd: hieunp" className={authInputClass}/>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Mật khẩu</span>
          <span className="relative block">
            <input type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required className={`${authInputClass} pr-11`}/>
            <button type="button" onClick={() => setShowPassword(shown => !shown)} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:text-slate-700">
              {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </button>
          </span>
        </label>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={loading} className={authButtonClass}>{loading ? "Đang đăng nhập…" : "Đăng nhập"}</button>
      </div>
    </form>
  );
}
