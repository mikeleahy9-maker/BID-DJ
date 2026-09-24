import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app-url";
import { HELPER_COOKIE } from "@/lib/helper-session";

export async function GET() {
  const res = NextResponse.redirect(new URL("/dj-login", getAppUrl()));
  res.cookies.set(HELPER_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}