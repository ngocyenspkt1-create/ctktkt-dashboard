import { getRawDb } from "@/db";
import { AppShell } from "@/components/app-shell";
import { AdminUsersPanel } from "@/components/admin-users-panel";

// Trang này luôn cần dữ liệu mới nhất (đọc DB) và chỉ Quản trị mới vào được
// (đã chặn ở middleware) — không cho Next.js cố dựng tĩnh lúc build, vì lúc
// đó chưa có kết nối Turso thật.
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const { results } = await getRawDb()
    .prepare("SELECT id, username, display_name AS displayName, role, created_at AS createdAt FROM users ORDER BY id")
    .all();

  return (
    <AppShell active="admin-users" hideSearch>
      <div className="mb-4">
        <h1 className="text-lg font-extrabold text-[#173b64]">Quản lý tài khoản</h1>
        <p className="text-sm text-slate-500">Tạo, đổi vai trò, đổi mật khẩu hoặc xoá tài khoản truy cập web.</p>
      </div>
      <AdminUsersPanel initialUsers={results as never[]}/>
    </AppShell>
  );
}
