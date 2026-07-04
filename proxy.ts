// proxy.ts — Next.js 16 "proxy" convention (formerly middleware): route protection.
//
// The prior proxy.js looked for the cookie `__Secure-authjs.session-token` in
// production, but authOptions hardcodes the cookie name to `authjs.session-token`
// (no __Secure- prefix) in BOTH environments — so in production it could never
// find the session. That bug is fixed here.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// authOptions.cookies.sessionToken.name is hardcoded to this in BOTH envs,
// so we must read the same name in dev and prod (no __Secure- prefix).
const SESSION_COOKIE_NAME = "authjs.session-token";

const PUBLIC_ROUTES = ["/login", "/register", "/"];

export async function proxy(req: NextRequest) {
  const url = req.nextUrl;

  // Decode the NextAuth JWT in the edge runtime — gives us role without a DB call.
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: SESSION_COOKIE_NAME,
  });

  const isLoggedIn = !!token;
  const isAdmin = (token?.role ?? "user") === "admin";

  const isAuthRoute = url.pathname.startsWith("/api/auth");
  const isPublicRoute = PUBLIC_ROUTES.includes(url.pathname);
  const isAdminRoute = url.pathname.startsWith("/admin");
  const isDashRoute = url.pathname.startsWith("/dashboard");

  // Always allow NextAuth internals.
  if (isAuthRoute) return NextResponse.next();

  // Not logged in → block all private routes.
  if (!isLoggedIn && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Logged in + on a public route → route by role.
  if (isLoggedIn && isPublicRoute) {
    return NextResponse.redirect(new URL(isAdmin ? "/admin" : "/dashboard", req.url));
  }

  // Non-admin trying to reach /admin → send to dashboard.
  if (isAdminRoute && !isAdmin) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Admin hitting /dashboard → send to /admin.
  if (isAdmin && isDashRoute) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login", "/register", "/"],
};
