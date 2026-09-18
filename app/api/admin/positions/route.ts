import { getRawDb } from "@/db";
import { requireAdmin } from "@/lib/auth/server";
import { DEFAULT_POSITIONS } from "@/lib/auth/initial-users-data";
import { PERMISSIONS, ROLES, type Permission, type Role } from "@/lib/auth/session";

export type PositionItem = {
  id?: number;
  position: string;
  category: string;
  role: Role;
  permissions: Permission[];
  description: string;
  userCount: number;
  updatedAt?: string;
};

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const db = getRawDb();

  // Đảm bảo bảng position_permissions tồn tại
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS position_permissions (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        position text NOT NULL,
        role text DEFAULT 'viewer' NOT NULL,
        permissions text DEFAULT '[]' NOT NULL,
        description text DEFAULT '' NOT NULL,
        updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `).run();
    await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS uidx_position_permissions_position ON position_permissions (position)`).run();
  } catch {}

  // Đọc danh sách phân quyền cương vị hiện có
  let dbRows: Array<{ id: number; position: string; role: string; permissions: string; description: string; updated_at: string }> = [];
  try {
    const { results } = await db
      .prepare("SELECT id, position, role, permissions, description, updated_at FROM position_permissions ORDER BY id")
      .all();
    dbRows = results as typeof dbRows;
  } catch {}

  // Đếm số lượng nhân sự theo từng cương vị
  const userCountMap = new Map<string, number>();
  try {
    const { results: counts } = await db
      .prepare("SELECT position, COUNT(*) AS count FROM users WHERE position IS NOT NULL AND position != '' GROUP BY position")
      .all();
    for (const r of counts as Array<{ position: string; count: number }>) {
      userCountMap.set(r.position, Number(r.count));
    }
  } catch {}

  // Ghép nối với 25 cương vị chuẩn (nếu DB chưa có thì tự động khởi tạo mặc định)
  const existingMap = new Map(dbRows.map(r => [r.position, r]));
  const positions: PositionItem[] = [];

  for (const def of DEFAULT_POSITIONS) {
    const existing = existingMap.get(def.position);
    if (existing) {
      let parsedPerms: Permission[] = [];
      try {
        parsedPerms = JSON.parse(existing.permissions);
      } catch {}
      positions.push({
        id: existing.id,
        position: existing.position,
        category: def.category,
        role: (ROLES.includes(existing.role as Role) ? existing.role : def.role) as Role,
        permissions: parsedPerms.filter(p => PERMISSIONS.includes(p)),
        description: existing.description || def.description,
        userCount: userCountMap.get(def.position) || 0,
        updatedAt: existing.updated_at,
      });
      existingMap.delete(def.position);
    } else {
      // Tự động lưu giá trị mặc định vào DB
      try {
        await db.prepare(
          "INSERT OR IGNORE INTO position_permissions (position, role, permissions, description) VALUES (?, ?, ?, ?)"
        ).bind(def.position, def.role, JSON.stringify(def.permissions), def.description).run();
      } catch {}
      positions.push({
        position: def.position,
        category: def.category,
        role: def.role,
        permissions: def.permissions,
        description: def.description,
        userCount: userCountMap.get(def.position) || 0,
      });
    }
  }

  // Các cương vị tùy biến khác (nếu người dùng thêm ngoài 25 cương vị chuẩn)
  for (const [, extra] of existingMap) {
    let parsedPerms: Permission[] = [];
    try {
      parsedPerms = JSON.parse(extra.permissions);
    } catch {}
    positions.push({
      id: extra.id,
      position: extra.position,
      category: "Khác",
      role: (ROLES.includes(extra.role as Role) ? extra.role : "viewer") as Role,
      permissions: parsedPerms.filter(p => PERMISSIONS.includes(p)),
      description: extra.description,
      userCount: userCountMap.get(extra.position) || 0,
      updatedAt: extra.updated_at,
    });
  }

  return Response.json({ positions, permissionsCatalog: PERMISSIONS });
}

export async function PUT(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ error: "Yêu cầu phải là JSON." }, { status: 415 });
  }

  const body = await request.json().catch(() => null) as {
    positions?: Array<{
      position: string;
      role?: string;
      permissions: string[];
      description?: string;
    }>;
    position?: string;
    role?: string;
    permissions?: string[];
    description?: string;
  } | null;

  const db = getRawDb();
  const listToUpdate: Array<{ position: string; role?: string; permissions: string[]; description?: string }> = [];

  if (Array.isArray(body?.positions)) {
    listToUpdate.push(...body.positions);
  } else if (typeof body?.position === "string") {
    listToUpdate.push({
      position: body.position,
      role: body.role,
      permissions: body.permissions || [],
      description: body.description,
    });
  } else {
    return Response.json({ error: "Dữ liệu cập nhật không hợp lệ." }, { status: 400 });
  }

  try {
    for (const item of listToUpdate) {
      const posName = item.position.trim();
      if (!posName) continue;
      const validRole = ROLES.includes(item.role as Role) ? item.role : "viewer";
      const validPerms = (item.permissions || []).filter(p => PERMISSIONS.includes(p as Permission));

      const existing = await db.prepare("SELECT id FROM position_permissions WHERE position = ?").bind(posName).first();
      if (existing) {
        await db.prepare(
          "UPDATE position_permissions SET role = ?, permissions = ?, description = COALESCE(?, description), updated_at = CURRENT_TIMESTAMP WHERE position = ?"
        ).bind(validRole, JSON.stringify(validPerms), item.description || null, posName).run();
      } else {
        await db.prepare(
          "INSERT INTO position_permissions (position, role, permissions, description) VALUES (?, ?, ?, ?)"
        ).bind(posName, validRole, JSON.stringify(validPerms), item.description || "").run();
      }

      // Tự động đồng bộ vai trò (role) cho tất cả nhân sự thuộc Cương vị này trong bảng users
      await db.prepare("UPDATE users SET role = ? WHERE position = ?").bind(validRole, posName).run();
    }

    return Response.json({ ok: true, updatedCount: listToUpdate.length });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không lưu được phân quyền." }, { status: 500 });
  }
}

