import { NextRequest, NextResponse } from "next/server";
import { readHelperSession } from "@/lib/helper-session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Helper queue: reject/decline a pending song request.
 *
 * Helpers authenticate with an HMAC cookie, so the browser client has no
 * Supabase session (auth.uid() null) and the RLS-gated requests update is
 * denied. This route uses the admin client, scoped to the session's event.
 */
export async function POST(req: NextRequest) {
  const helper = await readHelperSession();
  if (!helper) {
    return NextResponse.json({ error: "Not in helper mode." }, { status: 401 });
  }

  let body: { requestId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const requestId = String(body?.requestId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: request, error: requestError } = await supabase
      .from("requests")
      .select("id, event_id, status")
      .eq("id", requestId)
      .maybeSingle();
    if (requestError || !request) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }
    if (request.event_id !== helper.eventId) {
      return NextResponse.json({ error: "Request not in this event." }, { status: 403 });
    }
    if (request.status !== "pending") {
      return NextResponse.json({ error: "Request already handled." }, { status: 400 });
    }

    const { error } = await supabase
      .from("requests")
      .update({ status: "rejected" })
      .eq("id", requestId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[helper reject] failed:", err);
    return NextResponse.json(
      { error: "Could not decline the request. Please try again." },
      { status: 500 }
    );
  }
}