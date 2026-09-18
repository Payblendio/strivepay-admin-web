import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, loginHref, signedInLanding } from "@/lib/admin-access";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  const isLogin = pathname === "/login";
  const sessionExpired = request.nextUrl.searchParams.get("reason") === "session-expired";

  if (isLogin && sessionExpired) {
    const response = NextResponse.next();
    response.cookies.delete(ACCESS_COOKIE);
    return response;
  }

  if (!token && !isLogin) {
    return NextResponse.redirect(new URL(loginHref(pathname), request.url));
  }
  if (token && isLogin) {
    const returnTo = request.nextUrl.searchParams.get("returnTo");
    return NextResponse.redirect(new URL(signedInLanding(returnTo), request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|branding|api).*)"],
};
