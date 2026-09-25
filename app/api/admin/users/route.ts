import { getRawDb } from "@/db";
import { requireAdmin } from "@/lib/auth/server";
import { hashPassword, PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { PERMISSIONS, ROLES, type Permission, type Role } from "@/lib/auth/session";
import { ensureUserSchema } from "@/lib/auth/user-schema";

const usernamePattern = /^[a-z0-9._-]{3,32}$/;

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const rawDb = getRawDb();
    await ensureUserSchema(rawDb);

    const { results } = await rawDb
      .prepare(`
        SELECT 
          u.id, 
          u.username, 
          u.display_name AS displayName, 
          u.role, 
          u.employee_code AS employeeCode, 
          u.position, 
          u.department, 
          u.email_company AS emailCompany, 
          u.email_work AS emailWork, 
          u.phone, 
          COALESCE(u.status, 'active') AS status, 
          u.created_at AS createdAt,
          COALESCE(p.permissions, '[]') AS permissionsJson
        FROM users u
        LEFT JOIN position_permissions p ON u.position = p.position
        ORDER BY u.id
      `)
      .all();

    const users = (results as Array<{
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
      permissionsJson?: string;
    }>).map(user => {
      let permissions: Permission[] = [];
      try {
        if (user.permissionsJson) {
          const parsed = JSON.parse(user.permissionsJson);
          if (Array.isArray(parsed)) permissions = parsed.filter(p => PERMISSIONS.includes(p));
        }
      } catch {}
      if (permissions.length === 0 && user.role === "admin") {
        permissions = [...PERMISSIONS];
      }
      return {
        ...user,
        permissions,
      };
    });

    return Response.json({ users });
  } catch {
    // Dự phòng khi bảng users chưa có các cột mới (chưa chạy migration)
    const { results } = await getRawDb()
      .prepare("SELECT id, username, display_name AS displayName, role, created_at AS createdAt FROM users ORDER BY id")
      .all();
    return Response.json({ users: results });
  }
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ error: "Yêu cầu phải là JSON." }, { status: 415 });
  }

  const body = await request.json().catch(() => null) as {
    username?: unknown;
    password?: unknown;
    displayName?: unknown;
    role?: unknown;
    employeeCode?: unknown;
    position?: unknown;
    department?: unknown;
    emailCompany?: unknown;
    emailWork?: unknown;
    phone?: unknown;
  } | null;

  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  const employeeCode = typeof body?.employeeCode === "string" ? body.employeeCode.trim() : "";
  const position = typeof body?.position === "string" ? body.position.trim() : "";
  const department = typeof body?.department === "string" && body.department.trim() ? body.department.trim() : "Vận hành 1";
  const emailCompany = typeof body?.emailCompany === "string" ? body.emailCompany.trim() : "";
  const emailWork = typeof body?.emailWork === "string" ? body.emailWork.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

  let role = typeof body?.role === "string" ? body.role : "";
  if (!role && position) {
    // Kế thừa vai trò từ Cương vị
    const posRow = await getRawDb().prepare("SELECT role FROM position_permissions WHERE position = ?").bind(position).first() as { role: string } | null;
    if (posRow?.role) role = posRow.role;
  }
  if (!role || !ROLES.includes(role as Role)) {
    role = "viewer";
  }

  if (!usernamePattern.test(username)) {
    return Response.json({ error: "Tên đăng nhập chỉ gồm chữ thường, số, dấu chấm/gạch (3-32 ký tự)." }, { status: 400 });
  }
  if (password.length < PASSWORD_MIN_LENGTH) return Response.json({ error: `Mật khẩu tạm phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự.` }, { status: 400 });
  if (!displayName) return Response.json({ error: "Nhập tên hiển thị." }, { status: 400 });

  try {
    const rawDb = getRawDb();
    await ensureUserSchema(rawDb);
    const passwordHash = hashPassword(password);
    const created = await rawDb
      .prepare(`
        INSERT INTO users (
          username, password_hash, display_name, role, employee_code, position, department, email_company, email_work, phone, status, must_change_password
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0)
        RETURNING id, username, display_name AS displayName, role, employee_code AS employeeCode, position, department, email_company AS emailCompany, status, created_at AS createdAt
      `)
      .bind(username, passwordHash, displayName, role, employeeCode || null, position || null, department, emailCompany || null, emailWork || null, phone || null)
      .first();
    return Response.json({ user: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE") || message.includes("unique")) {
      return Response.json({ error: `Tên đăng nhập "${username}" đã tồn tại.` }, { status: 409 });
    }
    return Response.json({ error: "Không tạo được tài khoản." }, { status: 500 });
  }
}
