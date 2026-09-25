"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ChangePasswordForm({ displayName, required }: { displayName: string; required: boolean }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu nhập lại không khớp.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error || "Chưa đổi được mật khẩu.");
      router.replace("/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Chưa đổi được mật khẩu.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const inputClass = "rounded-xl border border-slate-300 px-3 py-2 font-normal text-black";
  return (
    <form onSubmit={submit} className="grid w-full max-w-sm gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
      <div>
        <h1 className="text-lg font-extrabold text-[#173b64]">Đổi mật khẩu</h1>
        <p className="mt-1 text-sm text-slate-500">{displayName}</p>
        {required && (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
            Mật khẩu hiện tại là mật khẩu tạm hoặc quá dễ đoán. Hãy đặt mật khẩu mới để tiếp tục sử dụng hệ thống.
          </p>
        )}
      </div>
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        Mật khẩu hiện tại
        <input type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} autoComplete="current-password" autoFocus required className={inputClass}/>
      </label>
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        Mật khẩu mới
        <input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} autoComplete="new-password" required minLength={8} className={inputClass}/>
        <span className="text-[11px] font-normal text-slate-500">Ít nhất 8 ký tự, có cả chữ và số, không chứa tên đăng nhập.</span>
      </label>
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        Nhập lại mật khẩu mới
        <input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" required minLength={8} className={inputClass}/>
      </label>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold leading-5 text-red-700">{error}</p>}
      <button type="submit" disabled={loading} className="rounded-xl bg-[#334785] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{loading ? "Đang lưu…" : "Đổi mật khẩu"}</button>
      {required
        ? <button type="button" onClick={() => void logout()} className="text-xs font-semibold text-slate-500 underline">Đăng xuất</button>
        : <Link href="/" className="text-center text-xs font-semibold text-slate-500 underline">Quay lại</Link>}
    </form>
  );
}
