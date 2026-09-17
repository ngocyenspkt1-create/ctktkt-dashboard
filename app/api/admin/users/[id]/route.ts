import { getRawDb } from "@/db";
import { requireAdmin } from "@/lib/auth/server";
import { hashPassword } from "@/lib/auth/password";
import { ROLES, type Role } from "@/lib/auth/session";

type UserRow = { id: number; role: string };

async function countAdmins(excludingId?: number) {
  const db = getRawDb();
  const { results } = excludingId
    ? await db.prepare("SELECT id FROM users WHERE role = 'admin' AND id != ?").bind(excludingId).all()
    : await db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
  return results.length;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "ID tài khoản không hợp lệ." }, { status: 400 });
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "Yêu cầu phải là JSON." }, { status: 415 });

  const body = await request.json().catch(() => null) as { displayName?: unknown; role?: unknown; password?: unknown } | null;
  const db = getRawDb();
  const existing = await db.prepare("SELECT id, role FROM users WHERE id = ?").bind(id).first() as UserRow | null;
  if (!existing) return Response.json({ error: "Không tìm thấy tài khoản." }, { status: 404 });

  if (typeof body?.role === "string" && body.role !== existing.role) {
    if (!ROLES.includes(body.role as Role)) return Response.json({ error: "Vai trò không hợp lệ." }, { status: 400 });
    if (existing.role === "admin" && body.role !== "admin" && (await countAdmins(id)) === 0) {
      return Response.json({ error: "Không thể đổi vai trò — đây là tài khoản Quản trị cuối cùng." }, { status: 400 });
    }
    await db.prepare("UPDATE users SET role = ? WHERE id = ?").bind(body.role, id).run();
  }
  if (typeof body?.displayName === "string" && body.displayName.trim()) {
    await db.prepare("UPDATE users SET display_name = ? WHERE id = ?").bind(body.displayName.trim(), id).run();
  }
  if (typeof body?.password === "string" && body.password) {
    if (body.password.length < 6) return Response.json({ error: "Mật khẩu phải có ít nhất 6 ký tự." }, { status: 400 });
    await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(hashPassword(body.password), id).run();
  }

  const updated = await db.prepare("SELECT id, username, display_name AS displayName, role, created_at AS createdAt FROM users WHERE id = ?").bind(id).first();
  return Response.json({ user: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "ID tài khoản không hợp lệ." }, { status: 400 });

  const db = getRawDb();
  const existing = await db.prepare("SELECT id, role FROM users WHERE id = ?").bind(id).first() as UserRow | null;
  if (!existing) return Response.json({ error: "Không tìm thấy tài khoản." }, { status: 404 });
  if (existing.id === guard.user.id) return Response.json({ error: "Không thể tự xoá tài khoản đang đăng nhập." }, { status: 400 });
  if (existing.role === "admin" && (await countAdmins(id)) === 0) {
    return Response.json({ error: "Không thể xoá — đây là tài khoản Quản trị cuối cùng." }, { status: 400 });
  }

  await db.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
  return Response.json({ ok: true });
}
