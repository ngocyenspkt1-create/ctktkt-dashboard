"use client";

import { useState } from "react";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/auth/session";
import { useSessionUser } from "@/components/session-context";

type UserRow = { id: number; username: string; displayName: string; role: Role; createdAt: string };

export function AdminUsersPanel({ initialUsers }: { initialUsers: UserRow[] }) {
  const currentUser = useSessionUser();
  const [users, setUsers] = useState(initialUsers);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", displayName: "", role: "editor" as Role });
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    setError(""); setCreating(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json() as { user?: UserRow; error?: string };
      if (!response.ok || !body.user) throw new Error(body.error || "Không tạo được tài khoản.");
      setUsers(previous => [...previous, body.user as UserRow]);
      setForm({ username: "", password: "", displayName: "", role: "editor" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tạo được tài khoản.");
    } finally {
      setCreating(false);
    }
  }

  async function changeRole(user: UserRow, role: Role) {
    setError(""); setBusyId(user.id);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const body = await response.json() as { user?: UserRow; error?: string };
      if (!response.ok || !body.user) throw new Error(body.error || "Không đổi được vai trò.");
      setUsers(previous => previous.map(item => item.id === user.id ? body.user as UserRow : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không đổi được vai trò.");
    } finally {
      setBusyId(null);
    }
  }

  async function resetPassword(user: UserRow) {
    const password = window.prompt(`Nhập mật khẩu mới cho "${user.username}" (ít nhất 6 ký tự):`);
    if (!password) return;
    setError(""); setBusyId(user.id);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Không đổi được mật khẩu.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không đổi được mật khẩu.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeUser(user: UserRow) {
    if (!window.confirm(`Xoá tài khoản "${user.username}"? Không thể hoàn tác.`)) return;
    setError(""); setBusyId(user.id);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Không xoá được tài khoản.");
      setUsers(previous => previous.filter(item => item.id !== user.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không xoá được tài khoản.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-4">
      <form onSubmit={createUser} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-5 sm:items-end">
        <label className="grid gap-1 text-xs font-bold text-slate-700">Tên đăng nhập
          <input value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} required placeholder="vd: nguyenvana" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-black"/>
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-700">Mật khẩu
          <input type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} required minLength={6} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-black"/>
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-700">Tên hiển thị
          <input value={form.displayName} onChange={event => setForm({ ...form, displayName: event.target.value })} required placeholder="vd: Nguyễn Văn A" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-black"/>
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-700">Vai trò
          <select value={form.role} onChange={event => setForm({ ...form, role: event.target.value as Role })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-black">
            {ROLES.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
          </select>
        </label>
        <button type="submit" disabled={creating} className="h-[38px] rounded-lg bg-[#334785] px-4 text-sm font-bold text-white disabled:opacity-60">{creating ? "Đang tạo…" : "+ Tạo tài khoản"}</button>
      </form>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold leading-5 text-red-700">{error}</p>}

      <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead><tr className="bg-[#f1f4fb] text-left text-[#173b64]"><th className="p-3">Tên đăng nhập</th><th className="p-3">Tên hiển thị</th><th className="p-3">Vai trò</th><th className="p-3">Ngày tạo</th><th className="p-3 text-right">Thao tác</th></tr></thead>
          <tbody>
            {users.map(user => <tr key={user.id} className="border-t align-middle">
              <td className="p-3 font-bold">{user.username}{user.id === currentUser.id && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">bạn</span>}</td>
              <td className="p-3">{user.displayName}</td>
              <td className="p-3">
                <select value={user.role} disabled={busyId === user.id} onChange={event => changeRole(user, event.target.value as Role)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold">
                  {ROLES.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                </select>
              </td>
              <td className="p-3 text-xs text-slate-500">{user.createdAt}</td>
              <td className="p-3 text-right">
                <div className="inline-flex gap-2">
                  <button type="button" disabled={busyId === user.id} onClick={() => resetPassword(user)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-60">Đổi mật khẩu</button>
                  <button type="button" disabled={busyId === user.id || user.id === currentUser.id} onClick={() => removeUser(user)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 disabled:opacity-60">Xoá</button>
                </div>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
