import { NextResponse } from "next/server";
import { verifyToken } from "base/utils/auth";

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("accessToken")?.value;

  if (!token) {
    const loginUrl = new URL("/login-register", request.url);
    loginUrl.searchParams.set(
      "callbackUrl",
      request.nextUrl.pathname + request.nextUrl.search,
    );
    return NextResponse.redirect(loginUrl);
  }

  // The UI gate is only a first line of defence. Admin APIs still verify the
  // current database role with requireAdmin() and never trust this JWT alone.
  if (pathname.startsWith("/p-admin")) {
    const payload = verifyToken(token);
    if (!payload || payload.role !== "admin") {
      const notFoundUrl = new URL("/p-admin/404-not-authorized", request.url);
      return NextResponse.rewrite(notFoundUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  runtime: "nodejs",
  matcher: ["/p-user/:path*", "/p-admin/:path*"],
};
