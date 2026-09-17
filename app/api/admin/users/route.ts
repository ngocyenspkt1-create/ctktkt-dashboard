import { getRawDb } from "@/db";
import { requireAdmin } from "@/lib/auth/server";
import { hashPassword } from "@/lib/auth/password";
import { ROLES, type Role } from "@/lib/auth/session";

const usernamePattern = /^[a-z0-9._-]{3,32}$/;

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { results } = await getRawDb()
    .prepare("SELECT id, username, display_name AS displayName, role, created_at AS createdAt FROM users ORDER BY id")
    .all();
  return Response.json({ users: results });
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "Yêu cầu phải là JSON." }, { status: 415 });

  const body = await request.json().catch(() => null) as { username?: unknown; password?: unknown; displayName?: unknown; role?: unknown } | null;
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  const role = typeof body?.role === "string" ? body.role : "";

  if (!usernamePattern.test(username)) return Response.json({ error: "Tên đăng nhập chỉ gồm chữ thường, số, dấu chấm/gạch (3-32 ký tự)." }, { status: 400 });
  if (password.length < 6) return Response.json({ error: "Mật khẩu phải có ít nhất 6 ký tự." }, { status: 400 });
  if (!displayName) return Response.json({ error: "Nhập tên hiển thị." }, { status: 400 });
  if (!ROLES.includes(role as Role)) return Response.json({ error: "Vai trò không hợp lệ." }, { status: 400 });

  try {
    const passwordHash = hashPassword(password);
    const created = await getRawDb()
      .prepare("INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?) RETURNING id, username, display_name AS displayName, role, created_at AS createdAt")
      .bind(username, passwordHash, displayName, role)
      .first();
    return Response.json({ user: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE") || message.includes("unique")) return Response.json({ error: `Tên đăng nhập "${username}" đã tồn tại.` }, { status: 409 });
    return Response.json({ error: "Không tạo được tài khoản." }, { status: 500 });
  }
}
