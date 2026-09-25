import { cookies } from "next/headers";
import { getRawDb } from "@/db";
import { clearFailedLogins, clientIp, loginRetryAfter, recordFailedLogin } from "@/lib/auth/login-throttle";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, PERMISSIONS, ROLES, SESSION_COOKIE, SESSION_MAX_AGE, type Permission, type Role } from "@/lib/auth/session";
import { ensureUserSchema } from "@/lib/auth/user-schema";

type UserRow = {
  id: number;
  username: string;
  passwordHash: string;
  displayName: string;
  role: string;
  employeeCode?: string;
  position?: string;
  status?: string;
  mustChangePassword?: number | null;
};

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "Yêu cầu phải là JSON." }, { status: 415 });
  const body = await request.json().catch(() => null) as { username?: unknown; password?: unknown } | null;
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase().slice(0, 64) : "";
  const password = typeof body?.password === "string" ? body.password.slice(0, 256) : "";
  if (!username || !password) return Response.json({ error: "Nhập tên đăng nhập và mật khẩu." }, { status: 400 });

  let row: UserRow | null;
  const db = getRawDb();
  const ip = clientIp(request);
  try {
    await ensureUserSchema(db);
    const retryAfter = await loginRetryAfter(db, username, ip);
    if (retryAfter !== null) {
      return Response.json(
        { error: `Đăng nhập sai quá nhiều lần. Hãy thử lại sau ${Math.ceil(retryAfter / 60)} phút.` },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
    row = await db
      .prepare("SELECT id, username, password_hash AS passwordHash, display_name AS displayName, role, employee_code AS employeeCode, position, status, must_change_password AS mustChangePassword FROM users WHERE LOWER(username) = ?")
      .bind(username)
      .first() as UserRow | null;
  } catch {
    return Response.json({ error: "Chưa truy cập được kho dữ liệu. Hãy thử lại." }, { status: 503 });
  }

  if (!row || !ROLES.includes(row.role as Role) || !verifyPassword(password, row.passwordHash)) {
    await recordFailedLogin(db, username, ip).catch(() => undefined);
    return Response.json({ error: "Sai tên đăng nhập hoặc mật khẩu." }, { status: 401 });
  }
  await clearFailedLogins(db, username).catch(() => undefined);
  // Password changes are voluntary for now (test deployment); the flag only applies when set explicitly in the database.
  const mustChangePassword = Number(row.mustChangePassword) === 1;

  if (row.status === "locked") {
    return Response.json({ error: "Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ Quản trị viên." }, { status: 403 });
  }

  // Nạp quyền từ cấu hình Cương vị (position_permissions)
  let permissions: Permission[] = [];
  if (row.position) {
    try {
      const posRow = await db
        .prepare("SELECT permissions FROM position_permissions WHERE position = ?")
        .bind(row.position)
        .first() as { permissions: string } | null;
      if (posRow?.permissions) {
        const parsed = JSON.parse(posRow.permissions);
        if (Array.isArray(parsed)) {
          permissions = parsed.filter(p => PERMISSIONS.includes(p));
        }
      }
    } catch {
      // Bỏ qua nếu bảng chưa sẵn sàng, dùng fallback bên dưới
    }
  }

  // Fallback quyền mặc định nếu chưa cấu hình trong DB
  if (permissions.length === 0) {
    if (row.role === "admin") {
      permissions = [...PERMISSIONS];
    } else if (row.role === "supervisor") {
      permissions = ["view_all", "edit_bcsx", "edit_daily_inputs", "edit_water", "sync_qlkt"];
    } else if (row.role === "technician") {
      permissions = ["view_all", "edit_monthly_kpi", "edit_daily_inputs", "edit_ppa", "edit_pmis", "edit_water", "sync_qlkt", "sync_google_sheet"];
    } else if (row.role === "editor") {
      permissions = ["view_all", "edit_monthly_kpi", "edit_daily_inputs", "edit_ppa", "edit_pmis", "edit_bcsx", "sync_qlkt"];
    } else {
      permissions = ["view_all"];
    }
  }

  const token = await createSessionToken({
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    role: row.role as Role,
    position: row.position,
    employeeCode: row.employeeCode,
    permissions,
    mustChangePassword,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE });
  return Response.json({
    ok: true,
    mustChangePassword,
    user: {
      username: row.username,
      displayName: row.displayName,
      role: row.role,
      position: row.position,
      employeeCode: row.employeeCode,
      permissions,
    },
  });
}
