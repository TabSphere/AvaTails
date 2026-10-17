import { NextRequest, NextResponse } from "next/server";

/**
 * Optional password gate. When FACTORY_PASSWORD is set, everything except
 * /login and /api/auth requires the auth cookie. When unset, the app is open.
 */
export function middleware(req: NextRequest) {
  const password = process.env.FACTORY_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const authed = req.cookies.get("avatails_auth")?.value === btoa(password);
  if (authed) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
