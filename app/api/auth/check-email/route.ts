import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * POST /api/auth/check-email
 * Body: { email: string }
 * Response: { exists: boolean }
 *
 * Reports whether a Supabase auth user already exists for an email, so the
 * signup form can warn before submitting. Uses the admin client (bypasses RLS).
 */
export async function POST(req: NextRequest) {
  let email: string;
  try {
    const body = await req.json();
    email = String(body.email ?? "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }

  try {
    const { data } = await getSupabaseAdmin()
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    return NextResponse.json({ exists: Boolean(data) });
  } catch (err) {
    console.error("[check-email] failed:", err);
    return NextResponse.json({ error: "Could not check email." }, { status: 500 });
  }
}