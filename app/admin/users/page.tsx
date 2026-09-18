import { getRawDb } from "@/db";
import { AppShell } from "@/components/app-shell";
import { AdminUsersPanel, type UserRow } from "@/components/admin-users-panel";
import { PERMISSIONS, type Permission, type Role } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  let initialUsers: UserRow[] = [];

  try {
    const { results } = await getRawDb()
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

    initialUsers = (results as Array<{
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
  } catch {
    try {
      const { results } = await getRawDb()
        .prepare("SELECT id, username, display_name AS displayName, role, created_at AS createdAt FROM users ORDER BY id")
        .all();
      initialUsers = (results as Array<{ id: number; username: string; displayName: string; role: Role; createdAt: string }>).map(u => ({
        ...u,
        status: "active",
      }));
    } catch {}
  }

  return (
    <AppShell active="admin-users" hideSearch>
      <AdminUsersPanel initialUsers={initialUsers} />
    </AppShell>
  );
}
