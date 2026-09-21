import { SignJWT, jwtVerify } from "jose";

export const ROLES = ["admin", "supervisor", "technician", "editor", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Quản trị",
  supervisor: "Trưởng ca / Giám sát",
  technician: "Kỹ thuật viên",
  editor: "Nhập liệu",
  viewer: "Chỉ xem",
};

export const PERMISSIONS = [
  "manage_users",
  "edit_monthly_kpi",
  "edit_daily_inputs",
  "edit_ppa",
  "edit_pmis",
  "edit_bcsx",
  "edit_water",
  "sync_qlkt",
  "sync_google_sheet",
  "view_all",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  manage_users: "Quản trị hệ thống & Phân quyền",
  edit_monthly_kpi: "Nhập chỉ tiêu KTKT tháng (7 chỉ tiêu)",
  edit_daily_inputs: "Nhập số liệu sản xuất ngày",
  edit_ppa: "Quản lý Suất hao nhiệt PPA",
  edit_pmis: "Quản lý Báo cáo PMIS (Tổn thất khói)",
  edit_bcsx: "Nhập liệu & Xuất báo cáo BCSX (48 điểm)",
  edit_water: "Quản lý theo dõi lượng nước theo ca",
  sync_qlkt: "Đồng bộ tự động từ QLKT",
  sync_google_sheet: "Đồng bộ dữ liệu Google Sheet",
  view_all: "Xem toàn bộ báo cáo & dữ liệu",
};

export type SessionUser = {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  position?: string;
  employeeCode?: string;
  permissions: Permission[];
};

export function isAdminUser(user: SessionUser | null | undefined): boolean {
  return Boolean(user && (user.role === "admin" || user.permissions?.includes("manage_users")));
}

export function hasPermission(user: SessionUser | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  if (permission === "view_all") return true;
  return user.permissions?.includes(permission) ?? false;
}

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 ngày

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "Thiếu biến môi trường AUTH_SECRET. Hãy đặt một chuỗi bí mật ngẫu nhiên (>=32 ký tự) trong Vercel Project Settings > Environment Variables."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    position: user.position || "",
    employeeCode: user.employeeCode || "",
    permissions: user.permissions || [],
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const id = Number(payload.sub);
    const role = payload.role as Role;
    if (!Number.isFinite(id) || typeof payload.username !== "string" || typeof payload.displayName !== "string" || !ROLES.includes(role)) {
      return null;
    }
    const permissions = Array.isArray(payload.permissions)
      ? (payload.permissions as Permission[]).filter(p => PERMISSIONS.includes(p))
      : [];
    return {
      id,
      username: payload.username,
      displayName: payload.displayName,
      role,
      position: typeof payload.position === "string" ? payload.position : undefined,
      employeeCode: typeof payload.employeeCode === "string" ? payload.employeeCode : undefined,
      permissions,
    };
  } catch {
    return null;
  }
}
