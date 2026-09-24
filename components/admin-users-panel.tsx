"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PERMISSION_LABELS,
  PERMISSIONS,
  ROLE_LABELS,
  ROLES,
  type Permission,
  type Role,
} from "@/lib/auth/session";
import { useSessionUser } from "@/components/session-context";

export type UserRow = {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  employeeCode?: string;
  position?: string;
  department?: string;
  emailCompany?: string;
  emailWork?: string;
  phone?: string;
  status: string;
  createdAt: string;
  permissions?: Permission[];
};

export type PositionRow = {
  id?: number;
  position: string;
  category: string;
  role: Role;
  permissions: Permission[];
  description: string;
  userCount: number;
  updatedAt?: string;
};

const CATEGORIES = ["Tất cả", "Lãnh đạo", "Kỹ thuật", "Vận hành ca", "Khối Lò", "Khối Máy", "Khối Điện", "Môi trường", "Hóa nước", "Phụ trợ", "Đo lường"];

async function safeJson<T = Record<string, unknown>>(res: Response): Promise<{ ok: boolean; status: number; data: T; error?: string }> {
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, status: res.status, data: {} as T, error: `Máy chủ phản hồi lỗi (${res.status}): ${text.slice(0, 120) || res.statusText}` };
  }
  if (!res.ok) {
    return { ok: false, status: res.status, data: data as T, error: (data.error as string) || `Yêu cầu thất bại (Mã lỗi ${res.status}).` };
  }
  return { ok: true, status: res.status, data: data as T };
}

export function AdminUsersPanel({ initialUsers }: { initialUsers: UserRow[] }) {
  const currentUser = useSessionUser();
  const [activeTab, setActiveTab] = useState<"positions" | "users">("positions");

  // State Quản lý Tài khoản
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [userSearch, setUserSearch] = useState("");
  const [selectedPositionFilter, setSelectedPositionFilter] = useState("Tất cả");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("Tất cả");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    username: "",
    password: "",
    displayName: "",
    employeeCode: "",
    position: "Trưởng ca",
    department: "Vận hành 1",
    emailCompany: "",
    role: "supervisor" as Role,
  });

  // State Quản lý Cương vị & Phân quyền
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(true);
  const [savingPositions, setSavingPositions] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("Tất cả");
  const [positionSearch, setPositionSearch] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Trạng thái chung
  const [busyId, setBusyId] = useState<number | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Nạp danh sách Cương vị từ API
  async function loadPositions() {
    try {
      setLoadingPositions(true);
      const res = await fetch("/api/admin/positions");
      const { ok, data, error } = await safeJson<{ positions?: PositionRow[]; error?: string }>(res);
      if (!ok || !data.positions) throw new Error(error || "Không thể tải danh sách cương vị.");
      setPositions(data.positions);
      setHasUnsavedChanges(false);
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Lỗi tải dữ liệu", type: "error" });
    } finally {
      setLoadingPositions(false);
    }
  }

  // Nạp danh sách tài khoản mới nhất
  async function refreshUsers() {
    try {
      const res = await fetch("/api/admin/users");
      const { ok, data } = await safeJson<{ users?: UserRow[] }>(res);
      if (ok && data.users) {
        setUsers(data.users);
      }
    } catch {}
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadPositions(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Thay đổi quyền cho 1 Cương vị
  function togglePermission(posIndex: number, perm: Permission) {
    setPositions(prev => {
      const copy = [...prev];
      const target = { ...copy[posIndex] };
      const currentPerms = new Set(target.permissions);
      if (currentPerms.has(perm)) {
        currentPerms.delete(perm);
      } else {
        currentPerms.add(perm);
      }
      target.permissions = Array.from(currentPerms);
      copy[posIndex] = target;
      return copy;
    });
    setHasUnsavedChanges(true);
  }

  // Thay đổi vai trò cho 1 Cương vị
  function changePositionRole(posIndex: number, role: Role) {
    setPositions(prev => {
      const copy = [...prev];
      copy[posIndex] = { ...copy[posIndex], role };
      return copy;
    });
    setHasUnsavedChanges(true);
  }

  // Áp dụng bộ mẫu quyền nhanh cho 1 Cương vị
  function applyPreset(posIndex: number, preset: "all" | "shift" | "tech" | "viewer") {
    setPositions(prev => {
      const copy = [...prev];
      const target = { ...copy[posIndex] };
      if (preset === "all") {
        target.role = "admin";
        target.permissions = [...PERMISSIONS];
      } else if (preset === "shift") {
        target.role = "supervisor";
        target.permissions = ["view_all", "edit_bcsx", "edit_daily_inputs", "edit_water", "sync_qlkt"];
      } else if (preset === "tech") {
        target.role = "technician";
        target.permissions = [
          "view_all",
          "edit_monthly_kpi",
          "edit_daily_inputs",
          "edit_ppa",
          "edit_pmis",
          "edit_water",
          "sync_qlkt",
          "sync_google_sheet",
        ];
      } else {
        target.role = "viewer";
        target.permissions = ["view_all"];
      }
      copy[posIndex] = target;
      return copy;
    });
    setHasUnsavedChanges(true);
  }

  // Lưu toàn bộ cấu hình phân quyền Cương vị
  async function savePositions() {
    setSavingPositions(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/positions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positions }),
      });
      const { ok, data, error } = await safeJson<{ ok?: boolean; error?: string }>(res);
      if (!ok || !data.ok) throw new Error(error || "Không thể lưu phân quyền.");
      setMessage({ text: "Đã lưu cấu hình phân quyền Cương vị thành công!", type: "success" });
      setHasUnsavedChanges(false);
      refreshUsers();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Không lưu được phân quyền.", type: "error" });
    } finally {
      setSavingPositions(false);
    }
  }

  // Đồng bộ / Nạp 124 nhân sự ban đầu
  async function triggerSeedUsers() {
    if (!window.confirm("Hệ thống sẽ đồng bộ/khởi tạo 124 nhân sự và 25 cương vị theo danh sách chuẩn PXVH1. Tiếp tục?")) {
      return;
    }
    setSeeding(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/seed-users", { method: "POST" });
      const { ok, data, error } = await safeJson<{ message?: string; error?: string }>(res);
      if (!ok) throw new Error(error || "Lỗi đồng bộ nhân sự.");
      setMessage({ text: data.message || "Đã đồng bộ 124 tài khoản thành công!", type: "success" });
      await loadPositions();
      await refreshUsers();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Lỗi khi đồng bộ danh sách nhân sự.", type: "error" });
    } finally {
      setSeeding(false);
    }
  }

  // Tạo tài khoản mới thủ công
  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null); setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const { ok, data, error } = await safeJson<{ user?: UserRow; error?: string }>(res);
      if (!ok || !data.user) throw new Error(error || "Không tạo được tài khoản.");
      setUsers(prev => [data.user as UserRow, ...prev]);
      setForm({
        username: "",
        password: "",
        displayName: "",
        employeeCode: "",
        position: "Trưởng ca",
        department: "Vận hành 1",
        emailCompany: "",
        role: "supervisor",
      });
      setMessage({ text: `Đã tạo tài khoản "${data.user.username}" thành công!`, type: "success" });
      loadPositions();
    } catch (caught) {
      setMessage({ text: caught instanceof Error ? caught.message : "Không tạo được tài khoản.", type: "error" });
    } finally {
      setCreating(false);
    }
  }

  // Đổi mật khẩu cho người dùng
  async function resetPassword(user: UserRow) {
    const password = window.prompt(`Nhập mật khẩu mới cho "${user.displayName} (${user.username})" (tối thiểu 6 ký tự):`);
    if (password === null) return;
    const trimmed = password.trim();
    if (trimmed.length < 6) {
      setMessage({ text: "Mật khẩu mới phải có tối thiểu 6 ký tự.", type: "error" });
      return;
    }
    setMessage(null); setBusyId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: trimmed }),
      });
      const { ok, error } = await safeJson<{ error?: string }>(res);
      if (!ok) throw new Error(error || "Không đổi được mật khẩu.");
      setMessage({ text: `Đã đổi mật khẩu cho ${user.username} thành công.`, type: "success" });
    } catch (caught) {
      setMessage({ text: caught instanceof Error ? caught.message : "Không đổi được mật khẩu.", type: "error" });
    } finally {
      setBusyId(null);
    }
  }

  // Khóa / Mở khóa tài khoản
  async function toggleLockUser(user: UserRow) {
    const newStatus = user.status === "locked" ? "active" : "locked";
    const label = newStatus === "locked" ? "khóa" : "mở khóa";
    if (!window.confirm(`Bạn có chắc muốn ${label} tài khoản "${user.username}"?`)) return;
    setMessage(null); setBusyId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const { ok, data, error } = await safeJson<{ user?: UserRow; error?: string }>(res);
      if (!ok || !data.user) throw new Error(error || `Không thể ${label} tài khoản.`);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
      setMessage({ text: `Đã ${label} tài khoản "${user.username}".`, type: "success" });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : `Lỗi khi ${label} tài khoản.`, type: "error" });
    } finally {
      setBusyId(null);
    }
  }

  // Xóa tài khoản
  async function removeUser(user: UserRow) {
    if (!window.confirm(`Xoá vĩnh viễn tài khoản "${user.username}" (${user.displayName})?`)) return;
    setMessage(null); setBusyId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      const { ok, error } = await safeJson<{ error?: string }>(res);
      if (!ok) throw new Error(error || "Không xoá được tài khoản.");
      setUsers(prev => prev.filter(item => item.id !== user.id));
      setMessage({ text: `Đã xoá tài khoản "${user.username}".`, type: "success" });
      loadPositions();
    } catch (caught) {
      setMessage({ text: caught instanceof Error ? caught.message : "Không xoá được tài khoản.", type: "error" });
    } finally {
      setBusyId(null);
    }
  }

  // Lọc Cương vị
  const filteredPositions = useMemo(() => {
    return positions.filter(pos => {
      const matchCat = selectedCategory === "Tất cả" || pos.category === selectedCategory;
      const matchSearch = !positionSearch || pos.position.toLowerCase().includes(positionSearch.toLowerCase()) || pos.description.toLowerCase().includes(positionSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [positions, selectedCategory, positionSearch]);

  // Lọc Nhân sự
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const q = userSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        u.displayName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.employeeCode && u.employeeCode.toLowerCase().includes(q)) ||
        (u.position && u.position.toLowerCase().includes(q));

      const matchPos = selectedPositionFilter === "Tất cả" || u.position === selectedPositionFilter;
      const matchStatus =
        selectedStatusFilter === "Tất cả" ||
        (selectedStatusFilter === "Hoạt động" && u.status !== "locked") ||
        (selectedStatusFilter === "Tạm khóa" && u.status === "locked");

      return matchSearch && matchPos && matchStatus;
    });
  }, [users, userSearch, selectedPositionFilter, selectedStatusFilter]);

  return (
    <div className="grid gap-5">
      {/* Header & Thanh chuyển Tab */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-[#173b64]">Phân quyền Tài khoản & Cương vị</h1>
          <p className="mt-1 text-xs text-slate-500">
            Phân xưởng Vận hành 1 · {positions.length} Cương vị · {users.length} Nhân sự trong hệ thống
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={triggerSeedUsers}
            disabled={seeding}
            className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
            title="Nạp hoặc đồng bộ lại toàn bộ 124 nhân sự và 25 cương vị từ danh bạ gốc"
          >
            <span>⚡</span>
            {seeding ? "Đang đồng bộ…" : "Nạp/Đồng bộ 124 Nhân sự PXVH1"}
          </button>

          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("positions")}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                activeTab === "positions"
                  ? "bg-white text-[#1f3864] shadow-sm"
                  : "text-slate-600 hover:text-black"
              }`}
            >
              Phân quyền theo Cương vị ({positions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("users")}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                activeTab === "users"
                  ? "bg-white text-[#1f3864] shadow-sm"
                  : "text-slate-600 hover:text-black"
              }`}
            >
              Danh sách Nhân sự ({users.length})
            </button>
          </div>
        </div>
      </div>

      {/* Thông báo Message */}
      {message && (
        <div
          role="alert"
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-xs font-bold ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : message.type === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-blue-200 bg-blue-50 text-blue-800"
          }`}
        >
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 1: MA TRẬN PHÂN QUYỀN THEO CƯƠNG VỊ */}
      {/* ========================================================== */}
      {activeTab === "positions" && (
        <div className="grid gap-4">
          {/* Thanh công cụ lọc & nút Lưu */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={positionSearch}
                onChange={e => setPositionSearch(e.target.value)}
                placeholder="Tìm tên cương vị…"
                className="w-48 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-black outline-none focus:border-indigo-500 focus:bg-white"
              />
              <div className="flex flex-wrap gap-1">
                {CATEGORIES.slice(0, 6).map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                      selectedCategory === cat
                        ? "bg-[#1f3864] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasUnsavedChanges && (
                <span className="text-xs font-bold text-amber-600 animate-pulse">
                  ● Có thay đổi chưa lưu
                </span>
              )}
              <button
                type="button"
                onClick={savePositions}
                disabled={savingPositions || !hasUnsavedChanges}
                className="flex items-center gap-1.5 rounded-xl bg-[#1f3864] px-5 py-2 text-xs font-bold text-white shadow hover:bg-[#162a4d] disabled:opacity-50"
              >
                <span>💾</span>
                {savingPositions ? "Đang lưu…" : "Lưu phân quyền Cương vị"}
              </button>
            </div>
          </div>

          {/* Hướng dẫn ngắn */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs text-slate-700 leading-relaxed">
            💡 <strong>Hướng dẫn phân quyền:</strong> Tích chọn các quyền chức năng cho từng Cương vị dưới đây. Khi bạn bấm <strong>&quot;Lưu phân quyền Cương vị&quot;</strong>, toàn bộ nhân sự thuộc cương vị đó sẽ tự động kế thừa các quyền được chọn khi họ đăng nhập.
          </div>

          {/* Bảng Ma trận Phân quyền */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="report-data-table w-full min-w-[1120px] text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-[#f4f6fb] text-left text-slate-700">
                  <th className="p-3 font-bold">Cương vị</th>
                  <th className="p-3 font-bold text-center">Khối</th>
                  <th className="p-3 font-bold text-center">Nhân sự</th>
                  <th className="p-3 font-bold">Vai trò đại diện</th>
                  <th className="p-2 text-center font-bold text-indigo-900" title="Quản trị tài khoản & phân quyền">Quản trị</th>
                  <th className="p-2 text-center font-bold text-blue-900" title="Nhập và tính 7 chỉ tiêu KTKT tháng">Chỉ tiêu tháng</th>
                  <th className="p-2 text-center font-bold text-sky-900" title="Nhập số liệu sản xuất hàng ngày">Số liệu ngày</th>
                  <th className="p-2 text-center font-bold text-teal-900" title="Quản lý Suất hao nhiệt PPA">SHN PPA</th>
                  <th className="p-2 text-center font-bold text-purple-900" title="Quản lý Báo cáo PMIS">PMIS</th>
                  <th className="p-2 text-center font-bold text-emerald-900" title="Nhập 48 điểm nửa giờ & xuất BCSX">BCSX</th>
                  <th className="p-2 text-center font-bold text-cyan-900" title="Quản lý theo dõi lượng nước theo ca">Nước</th>
                  <th className="p-2 text-center font-bold text-amber-900" title="Kích hoạt đồng bộ tự động từ QLKT">ĐB QLKT</th>
                  <th className="p-2 text-center font-bold text-green-900" title="Đồng bộ Google Sheet">G-Sheet</th>
                  <th className="p-3 text-right font-bold">Gán nhanh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingPositions ? (
                  <tr>
                    <td colSpan={14} className="p-8 text-center text-slate-400">
                      Đang tải danh sách cương vị…
                    </td>
                  </tr>
                ) : filteredPositions.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="p-8 text-center text-slate-400">
                      Không tìm thấy cương vị nào phù hợp bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredPositions.map(pos => {
                    const originalIndex = positions.findIndex(p => p.position === pos.position);
                    const perms = new Set(pos.permissions);

                    return (
                      <tr key={pos.position} className="hover:bg-slate-50/80 transition-colors">
                        {/* Tên Cương vị */}
                        <td className="p-3 font-extrabold text-slate-900">
                          <div>{pos.position}</div>
                          <div className="text-[10px] font-normal text-slate-400">{pos.description}</div>
                        </td>

                        {/* Khối */}
                        <td className="p-3 text-center">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            {pos.category}
                          </span>
                        </td>

                        {/* Số nhân sự */}
                        <td className="p-3 text-center font-bold text-indigo-700">
                          <span className="inline-block rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px]">
                            {pos.userCount}
                          </span>
                        </td>

                        {/* Vai trò đại diện */}
                        <td className="p-3">
                          <select
                            value={pos.role}
                            onChange={e => changePositionRole(originalIndex, e.target.value as Role)}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800"
                          >
                            {ROLES.map(r => (
                              <option key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* 8 Checkbox quyền chức năng */}
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={pos.role === "admin" || perms.has("manage_users")}
                            disabled={pos.role === "admin"}
                            onChange={() => togglePermission(originalIndex, "manage_users")}
                            className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500"
                            title="Quản trị hệ thống & phân quyền"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={pos.role === "admin" || perms.has("edit_monthly_kpi")}
                            disabled={pos.role === "admin"}
                            onChange={() => togglePermission(originalIndex, "edit_monthly_kpi")}
                            className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                            title="Nhập chỉ tiêu KTKT tháng"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={pos.role === "admin" || perms.has("edit_daily_inputs")}
                            disabled={pos.role === "admin"}
                            onChange={() => togglePermission(originalIndex, "edit_daily_inputs")}
                            className="h-4 w-4 rounded text-sky-600 focus:ring-sky-500"
                            title="Nhập số liệu ngày"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={pos.role === "admin" || perms.has("edit_ppa")}
                            disabled={pos.role === "admin"}
                            onChange={() => togglePermission(originalIndex, "edit_ppa")}
                            className="h-4 w-4 rounded text-teal-600 focus:ring-teal-500"
                            title="Suất hao nhiệt PPA"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={pos.role === "admin" || perms.has("edit_pmis")}
                            disabled={pos.role === "admin"}
                            onChange={() => togglePermission(originalIndex, "edit_pmis")}
                            className="h-4 w-4 rounded text-purple-600 focus:ring-purple-500"
                            title="Báo cáo PMIS"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={pos.role === "admin" || perms.has("edit_bcsx")}
                            disabled={pos.role === "admin"}
                            onChange={() => togglePermission(originalIndex, "edit_bcsx")}
                            className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                            title="Nhập 48 điểm nửa giờ & xuất BCSX"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={pos.role === "admin" || perms.has("edit_water")}
                            disabled={pos.role === "admin"}
                            onChange={() => togglePermission(originalIndex, "edit_water")}
                            className="h-4 w-4 rounded text-cyan-600 focus:ring-cyan-500"
                            title="Quản lý theo dõi lượng nước theo ca"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={pos.role === "admin" || perms.has("sync_qlkt")}
                            disabled={pos.role === "admin"}
                            onChange={() => togglePermission(originalIndex, "sync_qlkt")}
                            className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500"
                            title="Đồng bộ tự động từ QLKT"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={pos.role === "admin" || perms.has("sync_google_sheet")}
                            disabled={pos.role === "admin"}
                            onChange={() => togglePermission(originalIndex, "sync_google_sheet")}
                            className="h-4 w-4 rounded text-green-600 focus:ring-green-500"
                            title="Đồng bộ Google Sheet"
                          />
                        </td>

                        {/* Nút gán mẫu nhanh */}
                        <td className="p-3 text-right">
                          <div className="inline-flex gap-1">
                            <button
                              type="button"
                              onClick={() => applyPreset(originalIndex, "all")}
                              className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-200"
                              title="Cấp toàn bộ quyền (Admin)"
                            >
                              Tất cả
                            </button>
                            <button
                              type="button"
                              onClick={() => applyPreset(originalIndex, "shift")}
                              className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100"
                              title="Quyền Trưởng ca (BCSX + Số liệu ngày + QLKT)"
                            >
                              Ca
                            </button>
                            <button
                              type="button"
                              onClick={() => applyPreset(originalIndex, "tech")}
                              className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100"
                              title="Quyền Kỹ thuật viên (Chỉ tiêu tháng + PPA + PMIS + QLKT + Sheet)"
                            >
                              KT
                            </button>
                            <button
                              type="button"
                              onClick={() => applyPreset(originalIndex, "viewer")}
                              className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-500 hover:bg-slate-100"
                              title="Chỉ có quyền xem"
                            >
                              Xem
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 2: DANH SÁCH NHÂN SỰ & TÀI KHOẢN */}
      {/* ========================================================== */}
      {activeTab === "users" && (
        <div className="grid gap-4">
          {/* Form thêm mới tài khoản */}
          <form
            onSubmit={createUser}
            className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3 lg:grid-cols-6 items-end"
          >
            <label className="grid gap-1 text-xs font-bold text-slate-700">
              Mã NV
              <input
                value={form.employeeCode}
                onChange={e => setForm({ ...form, employeeCode: e.target.value })}
                placeholder="vd: NĐDH0130"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-black"
              />
            </label>
            <label className="grid gap-1 text-xs font-bold text-slate-700">
              Họ và tên *
              <input
                value={form.displayName}
                onChange={e => setForm({ ...form, displayName: e.target.value })}
                required
                placeholder="vd: Nguyễn Văn A"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-black"
              />
            </label>
            <label className="grid gap-1 text-xs font-bold text-slate-700">
              Tên đăng nhập *
              <input
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                required
                placeholder="vd: nguyenvana"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-black"
              />
            </label>
            <label className="grid gap-1 text-xs font-bold text-slate-700">
              Mật khẩu *
              <input
                type="password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
                placeholder="Ít nhất 6 ký tự"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-black"
              />
            </label>
            <label className="grid gap-1 text-xs font-bold text-slate-700">
              Cương vị (Chức vụ) *
              <select
                value={form.position}
                onChange={e => setForm({ ...form, position: e.target.value })}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-black font-semibold"
              >
                {positions.map(p => (
                  <option key={p.position} value={p.position}>
                    {p.position}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={creating}
              className="h-[34px] rounded-lg bg-[#1f3864] px-4 text-xs font-bold text-white hover:bg-[#152747] disabled:opacity-60"
            >
              {creating ? "Đang tạo…" : "+ Thêm tài khoản"}
            </button>
          </form>

          {/* Bộ lọc tài khoản */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Tìm họ tên, mã NV, username…"
                className="w-64 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-black outline-none focus:border-indigo-500 focus:bg-white"
              />
              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                <span>Cương vị:</span>
                <select
                  value={selectedPositionFilter}
                  onChange={e => setSelectedPositionFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-800"
                >
                  <option value="Tất cả">Tất cả ({users.length})</option>
                  {positions.map(p => (
                    <option key={p.position} value={p.position}>
                      {p.position} ({p.userCount})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                <span>Trạng thái:</span>
                <select
                  value={selectedStatusFilter}
                  onChange={e => setSelectedStatusFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-800"
                >
                  <option value="Tất cả">Tất cả</option>
                  <option value="Hoạt động">Hoạt động</option>
                  <option value="Tạm khóa">Tạm khóa</option>
                </select>
              </div>
            </div>

            <div className="text-xs font-bold text-slate-500">
              Hiển thị {filteredUsers.length} / {users.length} tài khoản
            </div>
          </div>

          {/* Bảng Danh sách tài khoản */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="report-data-table w-full min-w-[850px] text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-[#f4f6fb] text-left text-slate-700">
                  <th className="p-3 font-bold">Mã NV</th>
                  <th className="p-3 font-bold">Họ và tên</th>
                  <th className="p-3 font-bold">Tên đăng nhập</th>
                  <th className="p-3 font-bold">Cương vị</th>
                  <th className="p-3 font-bold">Quyền hạn kế thừa</th>
                  <th className="p-3 text-center font-bold">Trạng thái</th>
                  <th className="p-3 text-right font-bold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      Không tìm thấy tài khoản phù hợp với tìm kiếm.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(u => {
                    const isSelf = u.id === currentUser.id;
                    const isLocked = u.status === "locked";

                    return (
                      <tr key={u.id} className={`hover:bg-slate-50/80 transition-colors ${isLocked ? "bg-slate-50 opacity-60" : ""}`}>
                        <td className="p-3 font-mono font-bold text-slate-700">
                          {u.employeeCode || "—"}
                        </td>
                        <td className="p-3 font-bold text-slate-900">
                          {u.displayName}
                          {isSelf && (
                            <span className="ml-1.5 rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-black text-blue-800">
                              BẠN
                            </span>
                          )}
                          {u.emailCompany && (
                            <div className="text-[10px] font-normal text-slate-400">{u.emailCompany}</div>
                          )}
                        </td>
                        <td className="p-3 font-mono font-semibold text-indigo-900">
                          {u.username}
                        </td>
                        <td className="p-3 font-bold text-slate-700">
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px]">
                            {u.position || "Chưa gán"}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1 max-w-[280px]">
                            {u.role === "admin" ? (
                              <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-black text-indigo-800">
                                Toàn quyền Quản trị
                              </span>
                            ) : u.permissions && u.permissions.length > 0 ? (
                              u.permissions.map(p => (
                                <span
                                  key={p}
                                  className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600"
                                  title={PERMISSION_LABELS[p]}
                                >
                                  {p.replace("edit_", "").replace("sync_", "")}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-400">Chỉ xem</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          {isLocked ? (
                            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-bold text-red-700">
                              Đã khóa
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                              Hoạt động
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="inline-flex gap-1.5">
                            <button
                              type="button"
                              disabled={busyId === u.id}
                              onClick={() => resetPassword(u)}
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                              title="Đặt mật khẩu mới"
                            >
                              Đổi MK
                            </button>
                            {!isSelf && (
                              <button
                                type="button"
                                disabled={busyId === u.id}
                                onClick={() => toggleLockUser(u)}
                                className={`rounded-lg border px-2 py-1 text-[11px] font-semibold disabled:opacity-60 ${
                                  isLocked
                                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                    : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                }`}
                              >
                                {isLocked ? "Mở khóa" : "Khóa"}
                              </button>
                            )}
                            {!isSelf && (
                              <button
                                type="button"
                                disabled={busyId === u.id}
                                onClick={() => removeUser(u)}
                                className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                              >
                                Xóa
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
