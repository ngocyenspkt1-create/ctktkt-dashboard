import { SignJWT, jwtVerify } from "jose";

export const ROLES = ["admin", "editor", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Quản trị",
  editor: "Nhập liệu",
  viewer: "Chỉ xem",
};

export type SessionUser = {
  id: number;
  username: string;
  displayName: string;
  role: Role;
};

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 ngày

// jose dùng Web Crypto API nên chạy được cả trong middleware (Edge runtime)
// lẫn route handler (Node runtime) — không dùng "jsonwebtoken"/node:crypto
// cho phần token vì middleware không có sẵn module "crypto" của Node.
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
  return new SignJWT({ username: user.username, displayName: user.displayName, role: user.role })
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
    const role = payload.role;
    if (!Number.isFinite(id) || typeof payload.username !== "string" || typeof payload.displayName !== "string" || !ROLES.includes(role as Role)) {
      return null;
    }
    return { id, username: payload.username, displayName: payload.displayName, role: role as Role };
  } catch {
    return null;
  }
}
