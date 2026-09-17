import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken, type SessionUser, type Role } from "./session";

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

type Guard = { ok: true; user: SessionUser } | { ok: false; response: Response };

// Middleware đã chặn mọi request chưa đăng nhập ở tầng ngoài (xem middleware.ts),
// nên guard này chỉ cần kiểm tra lại (phòng khi gọi route handler theo cách khác
// bỏ qua middleware) và áp thêm điều kiện về ROLE cho từng route.
export async function requireRole(...allowed: Role[]): Promise<Guard> {
  const user = await getSessionUser();
  if (!user) return { ok: false, response: Response.json({ error: "Chưa đăng nhập." }, { status: 401 }) };
  if (!allowed.includes(user.role)) {
    return { ok: false, response: Response.json({ error: "Tài khoản của bạn không có quyền thực hiện thao tác này." }, { status: 403 }) };
  }
  return { ok: true, user };
}

export const requireEditor = () => requireRole("admin", "editor");
export const requireAdmin = () => requireRole("admin");
