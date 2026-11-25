import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getGuestDeepLink } from "@/lib/auth-redirect";

/**
 * Keep QR deep links alive across authentication.
 *
 * `/join/{code}` lives behind the guest layout guard. Before that guard can
 * send an anonymous visitor to `/login`, capture the intended URL and carry it
 * in the redirect. Signed-in guests pass straight through, with the deep link
 * also exposed as a request header as a fallback for the layout guard.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const deepLink = getGuestDeepLink(`${pathname}${search}`);
  if (!deepLink) return NextResponse.next();

  // @supabase/ssr stores its session in `sb-<project>-auth-token` cookies.
  const hasSessionCookie = request.cookies
    .getAll()
    .some(({ name }) => name.startsWith("sb-") && name.includes("-auth-token"));

  if (!hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", deepLink);
    return NextResponse.redirect(loginUrl);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-bida-next", deepLink);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/join/:path*", "/request"],
};
