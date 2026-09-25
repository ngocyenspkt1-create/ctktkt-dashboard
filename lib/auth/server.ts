import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken, hasPermission, isAdminUser, type SessionUser, type Role, type Permission } from "./session";

/** Any valid session, including one that must change its password first. */
export async function getSessionUserForPasswordChange(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** A session allowed to use the application (password change not pending). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const user = await getSessionUserForPasswordChange();
  return user && !user.mustChangePassword ? user : null;
}

type Guard = { ok: true; user: SessionUser } | { ok: false; response: Response };

export async function requireRole(...allowed: Role[]): Promise<Guard> {
  const user = await getSessionUser();
  if (!user) return { ok: false, response: Response.json({ error: "Chưa đăng nhập." }, { status: 401 }) };
  if (!allowed.includes(user.role) && !isAdminUser(user)) {
    return { ok: false, response: Response.json({ error: "Tài khoản của bạn không có quyền thực hiện thao tác này." }, { status: 403 }) };
  }
  return { ok: true, user };
}

export async function requirePermission(permission: Permission): Promise<Guard> {
  const user = await getSessionUser();
  if (!user) return { ok: false, response: Response.json({ error: "Chưa đăng nhập." }, { status: 401 }) };
  if (!hasPermission(user, permission)) {
    return { ok: false, response: Response.json({ error: "Tài khoản của bạn không có quyền thực hiện thao tác này." }, { status: 403 }) };
  }
  return { ok: true, user };
}

export async function requireAnyPermission(...permissions: Permission[]): Promise<Guard> {
  const user = await getSessionUser();
  if (!user) return { ok: false, response: Response.json({ error: "Chưa đăng nhập." }, { status: 401 }) };
  if (!permissions.some(permission => hasPermission(user, permission))) {
    return { ok: false, response: Response.json({ error: "Tài khoản của bạn không có quyền thực hiện thao tác này." }, { status: 403 }) };
  }
  return { ok: true, user };
}

export async function requireAdmin(): Promise<Guard> {
  const user = await getSessionUser();
  if (!user) return { ok: false, response: Response.json({ error: "Chưa đăng nhập." }, { status: 401 }) };
  if (isAdminUser(user)) {
    return { ok: true, user };
  }
  return { ok: false, response: Response.json({ error: "Chỉ Quản trị viên mới có quyền thực hiện thao tác này." }, { status: 403 }) };
}
