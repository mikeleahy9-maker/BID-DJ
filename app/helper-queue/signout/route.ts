import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app-url";
import { HELPER_COOKIE } from "@/lib/helper-session";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.redirect(new URL("/dj-login", getAppUrl()));
  res.cookies.set(HELPER_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}