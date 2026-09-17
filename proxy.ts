import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? await verifySessionToken(token) : null;

  if (!user) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Khu vực quản lý tài khoản chỉ dành cho Quản trị — chặn ngay ở middleware
  // (route handler và trang /admin/users vẫn tự kiểm tra lại lần nữa, xem
  // lib/auth/server.ts, để không phụ thuộc duy nhất vào middleware).
  if ((pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) && user.role !== "admin") {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Chỉ Quản trị mới có quyền truy cập." }, { status: 403 });
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.svg|favicon\\.ico).*)"],
};
