import { cookies } from "next/headers";
import { getRawDb } from "@/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, ROLES, SESSION_COOKIE, SESSION_MAX_AGE, type Role } from "@/lib/auth/session";

type UserRow = { id: number; username: string; passwordHash: string; displayName: string; role: string };

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "Yêu cầu phải là JSON." }, { status: 415 });
  const body = await request.json().catch(() => null) as { username?: unknown; password?: unknown } | null;
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || !password) return Response.json({ error: "Nhập tên đăng nhập và mật khẩu." }, { status: 400 });

  let row: UserRow | null;
  try {
    row = await getRawDb()
      .prepare("SELECT id, username, password_hash AS passwordHash, display_name AS displayName, role FROM users WHERE username = ?")
      .bind(username)
      .first() as UserRow | null;
  } catch {
    return Response.json({ error: "Chưa truy cập được kho dữ liệu. Hãy thử lại." }, { status: 503 });
  }
  if (!row || !ROLES.includes(row.role as Role) || !verifyPassword(password, row.passwordHash)) {
    return Response.json({ error: "Sai tên đăng nhập hoặc mật khẩu." }, { status: 401 });
  }

  const token = await createSessionToken({ id: row.id, username: row.username, displayName: row.displayName, role: row.role as Role });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE });
  return Response.json({ ok: true, user: { username: row.username, displayName: row.displayName, role: row.role } });
}
