import { PERMISSIONS, ROLES, type Permission, type Role, type SessionUser } from "./session.ts";
import { migrateLegacyPermissions, normalizePermissions } from "./permission-migration.ts";

type AuthDb = ReturnType<typeof import("../../db/index").getRawDb>;
export async function positionPermissions(db: AuthDb, position: string): Promise<Permission[] | null> {
  let row = await db.prepare("SELECT role, permissions, permissions_version FROM position_permissions WHERE position = ?").bind(position).first();
  if (!row) return null;
  if (Number(row.permissions_version) < 2) {
    const permissions = migrateLegacyPermissions({ id: 0, username: "", displayName: "", position, role: row.role as Role, permissions: normalizePermissions(JSON.parse(String(row.permissions))) });
    await db.prepare("UPDATE position_permissions SET permissions = ?, permissions_version = 2 WHERE position = ? AND permissions_version < 2").bind(JSON.stringify(permissions), position).run();
    // Re-read in case an administrator saved a new configuration concurrently.
    row = await db.prepare("SELECT permissions FROM position_permissions WHERE position = ?").bind(position).first();
    if (!row) return null;
  }
  return normalizePermissions(JSON.parse(String(row.permissions)));
}

export function defaultRolePermissions(role: Role): Permission[] {
  if (role === "admin") return [...PERMISSIONS];
  if (role === "supervisor") return ["view_all", "edit_bcsx", "edit_daily_inputs", "edit_water", "sync_qlkt"];
  if (role === "technician") return ["view_all", "edit_monthly_kpi", "edit_daily_inputs", "edit_ppa", "edit_pmis", "edit_water", "sync_qlkt", "sync_google_sheet"];
  if (role === "editor") return ["view_all", "edit_monthly_kpi", "edit_daily_inputs", "edit_ppa", "edit_pmis", "edit_bcsx", "sync_qlkt"];
  return ["view_all"];
}

/** Read current account status and grants on every server request, never trust stale JWT grants. */
export async function loadCurrentUser(db: AuthDb, id: number): Promise<SessionUser | null> {
  const row = await db.prepare("SELECT id, username, display_name AS displayName, role, employee_code AS employeeCode, position, status, must_change_password AS mustChangePassword FROM users WHERE id = ?").bind(id).first();
  if (!row || row.status === "locked" || !ROLES.includes(row.role as Role)) return null;
  const user: SessionUser = { id: Number(row.id), username: String(row.username), displayName: String(row.displayName), role: row.role as Role, employeeCode: String(row.employeeCode || ""), position: String(row.position || ""), permissions: [], mustChangePassword: Number(row.mustChangePassword) === 1 };
  const configured = user.position ? await positionPermissions(db, user.position) : null;
  // An explicitly saved empty list is revocation, not an invitation to restore defaults.
  user.permissions = configured ?? migrateLegacyPermissions({ ...user, permissions: defaultRolePermissions(user.role) });
  return user;
}
