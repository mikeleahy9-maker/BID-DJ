import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server";
import { EVENT_PROJECTION } from "@/features/dj/lib/dj-events";

const VALID_STATUSES = ["draft", "live", "ended", "canceled"];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { eventId } = await params;
  if (!UUID_RE.test(eventId)) {
    return NextResponse.json({ error: "Invalid event id." }, { status: 400 });
  }

  let body: { status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const status = String(body?.status ?? "").trim();
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid event status." }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "dj") {
    return NextResponse.json(
      { error: "Only DJ accounts can update event status." },
      { status: 403 }
    );
  }

  const { data: existing } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("events")
    .update({ status })
    .eq("id", eventId)
    .select(EVENT_PROJECTION)
    .single();

  if (error) {
    console.error("[event-status] failed:", error);
    return NextResponse.json(
      { error: "Could not update the event. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, event: data });
}