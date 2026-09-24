import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { createHelperCookie, HELPER_COOKIE } from "@/lib/helper-session";

export async function POST(req: NextRequest) {
  let body: { code?: unknown; helperPin?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const code = String(body?.code ?? "").trim().toUpperCase();
  const helperPin = String(body?.helperPin ?? "").trim();

  if (!code) {
    return NextResponse.json({ error: "Please enter the event code." }, { status: 400 });
  }
  if (!/^\d{6}$/.test(helperPin)) {
    return NextResponse.json({ error: "Helper PIN must be 6 digits." }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();
  const { data: event, error } = await supabase
    .from("events")
    .select("id, dj_id, name, code, helper_pin, status")
    .eq("code", code)
    .maybeSingle();

  if (error) {
    console.error("[helper-login] event lookup failed:", error);
    return NextResponse.json(
      { error: "Could not reach the server. Please try again." },
      { status: 500 }
    );
  }

  if (!event) {
    return NextResponse.json(
      { error: "No event found with that code." },
      { status: 400 }
    );
  }
  if (event.status !== "live") {
    return NextResponse.json(
      { error: "This event isn't live yet — please check back later." },
      { status: 400 }
    );
  }
  if (event.helper_pin !== helperPin) {
    return NextResponse.json({ error: "Incorrect helper PIN." }, { status: 400 });
  }

  const res = NextResponse.json({
    ok: true,
    event: { id: event.id, code: event.code, name: event.name },
  });
  res.cookies.set(HELPER_COOKIE, createHelperCookie({
    eventId: event.id,
    djId: event.dj_id,
    code: event.code,
    name: event.name,
  }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}