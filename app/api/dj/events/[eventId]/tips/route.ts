import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/dj/events/[eventId]/tips
 *
 * The live tip feed the DJ watches during a gig: who tipped, how much, and any
 * message they left. Read with the DJ's own session so RLS
 * (tips_select_own_dj) is what grants access; only the event owner/DJ sees it.
 *
 * Each tip reports its gross (`amountCents`) and what the DJ actually receives
 * (`netCents` = amount minus Stripe's processing fee), since the whole tip goes
 * to the performer but Stripe still takes its cut.
 */
export async function GET(
  _req: NextRequest,
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

  const supabase = await getSupabaseServerClient();
  const { data: event } = await supabase
    .from("events")
    .select("dj_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  if (event.dj_id !== user.id) {
    return NextResponse.json(
      { error: "Only the event owner can view tips." },
      { status: 403 }
    );
  }

  const { data, error } = await supabase
    .from("tips")
    .select("id, nickname, amount_cents, fee_cents, message, status, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: "Could not load tips." }, { status: 500 });
  }

  const tips = (data ?? []).map((row) => ({
    id: row.id as string,
    nickname: (row.nickname as string | null) ?? "A guest",
    amountCents: Number(row.amount_cents),
    netCents: Math.max(0, Number(row.amount_cents) - Number(row.fee_cents)),
    message: (row.message as string | null) ?? null,
    status: row.status as string,
    createdAt: row.created_at as string,
  }));

  const totals = tips.reduce(
    (acc, tip) => {
      acc.count += 1;
      acc.grossCents += tip.amountCents;
      acc.netCents += tip.netCents;
      return acc;
    },
    { count: 0, grossCents: 0, netCents: 0 }
  );

  return NextResponse.json(
    { tips, totals },
    { headers: { "Cache-Control": "no-store" } }
  );
}
