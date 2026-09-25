import type { getRawDb } from "@/db";

type RawDb = ReturnType<typeof getRawDb>;

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILURES_PER_USERNAME = 5;
export const MAX_FAILURES_PER_IP = 30;

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

/** Seconds until the next attempt is allowed, or null when the login may proceed. */
export async function loginRetryAfter(db: RawDb, username: string, ip: string, now = Date.now()): Promise<number | null> {
  const since = now - LOGIN_WINDOW_MS;
  const [byUser, byIp] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS n, MIN(attempted_at) AS first FROM login_attempts WHERE username = ? AND attempted_at > ?").bind(username, since).first(),
    db.prepare("SELECT COUNT(*) AS n, MIN(attempted_at) AS first FROM login_attempts WHERE ip = ? AND attempted_at > ?").bind(ip, since).first(),
  ]) as Array<{ n: number; first: number | null } | null>;
  const blockedUntil = [
    Number(byUser?.n) >= MAX_FAILURES_PER_USERNAME ? Number(byUser?.first) + LOGIN_WINDOW_MS : 0,
    Number(byIp?.n) >= MAX_FAILURES_PER_IP ? Number(byIp?.first) + LOGIN_WINDOW_MS : 0,
  ].reduce((max, value) => Math.max(max, value), 0);
  return blockedUntil > now ? Math.ceil((blockedUntil - now) / 1000) : null;
}

export async function recordFailedLogin(db: RawDb, username: string, ip: string, now = Date.now()) {
  await db.batch([
    db.prepare("INSERT INTO login_attempts (username, ip, attempted_at) VALUES (?, ?, ?)").bind(username, ip, now),
    db.prepare("DELETE FROM login_attempts WHERE attempted_at < ?").bind(now - 24 * 60 * 60 * 1000),
  ]);
}

export async function clearFailedLogins(db: RawDb, username: string) {
  await db.prepare("DELETE FROM login_attempts WHERE username = ?").bind(username).run();
}
