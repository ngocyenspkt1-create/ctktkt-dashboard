import { cookies } from "next/headers";
import { getSessionUserForPasswordChange } from "@/lib/auth/server";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth/session";

export async function GET() {
  try {
    const user = await getSessionUserForPasswordChange();
    if (!user) return Response.json({ error: "Phiên đăng nhập không còn hiệu lực." }, { status: 401 });
    const store = await cookies();
    store.set(SESSION_COOKIE, await createSessionToken(user), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE });
    return Response.json({ user }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Chưa truy cập được cấu hình tài khoản." }, { status: 503 }); }
}
