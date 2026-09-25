import { cookies } from "next/headers";
import { getRawDb } from "@/db";
import { getSessionUserForPasswordChange } from "@/lib/auth/server";
import { hashPassword, validateNewPassword, verifyPassword } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth/session";
import { ensureUserSchema } from "@/lib/auth/user-schema";

export async function POST(request: Request) {
  const user = await getSessionUserForPasswordChange();
  if (!user) return Response.json({ error: "Chưa đăng nhập." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "Yêu cầu phải là JSON." }, { status: 415 });

  const body = await request.json().catch(() => null) as { currentPassword?: unknown; newPassword?: unknown } | null;
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword.slice(0, 256) : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  if (!currentPassword || !newPassword) return Response.json({ error: "Nhập mật khẩu hiện tại và mật khẩu mới." }, { status: 400 });

  const policyError = validateNewPassword(newPassword, user.username);
  if (policyError) return Response.json({ error: policyError }, { status: 400 });
  if (newPassword === currentPassword) return Response.json({ error: "Mật khẩu mới phải khác mật khẩu hiện tại." }, { status: 400 });

  const db = getRawDb();
  try {
    await ensureUserSchema(db);
    const row = await db.prepare("SELECT password_hash AS passwordHash, status FROM users WHERE id = ?").bind(user.id).first() as { passwordHash: string; status?: string } | null;
    if (!row || row.status === "locked") return Response.json({ error: "Tài khoản không còn hiệu lực." }, { status: 403 });
    if (!verifyPassword(currentPassword, row.passwordHash)) return Response.json({ error: "Mật khẩu hiện tại không đúng." }, { status: 400 });
    await db.prepare("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?").bind(hashPassword(newPassword), user.id).run();
  } catch {
    return Response.json({ error: "Chưa đổi được mật khẩu. Hãy thử lại." }, { status: 503 });
  }

  const token = await createSessionToken({ ...user, mustChangePassword: false });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE });
  return Response.json({ ok: true });
}
