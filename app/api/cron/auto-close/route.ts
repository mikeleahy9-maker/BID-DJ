import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { settleEvent } from "@/lib/settlement";

/**
 * POST /api/cron/auto-close
 *
 * Safety net for a DJ who went live and never ended the night. Any event still
 * 'live' 36 hours after it went live (events.live_at, stamped by a trigger on
 * the draft -> live transition) is closed the same way a manual end would be:
 * settleEvent() books the split and flips the event to 'ended'. Money still
 * moves later via the usual sweep -- closing never transfers.
 *
 * Runs as the system, not as the DJ: there is no session here, so settleEvent
 * is called with { system: true } and reads the unguarded event_finance_system
 * RPC with the service-role client. Passing the event's dj_id satisfies the
 * owner check without granting a real session.
 *
 * Auth mirrors /api/cron/settle: a shared secret forwarded by the pg_cron job
 * (bidabeat-auto-close, hourly), verified with a constant-time compare.
 *
 * Idempotent and safe to re-run: settleEvent() is keyed on the settlement row
 * (unique on event_id), so an overlapping or repeated sweep cannot close or
 * book an event twice.
 */
const AUTO_CLOSE_AFTER_MS = 36 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 500 });
  }

  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  const ok = a.length === b.length && timingSafeEqual(a, b);
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - AUTO_CLOSE_AFTER_MS).toISOString();

  const { data: stale, error } = await admin
    .from("events")
    .select("id, dj_id")
    .eq("status", "live")
    .not("live_at", "is", null)
    .lt("live_at", cutoff);

  if (error) {
    console.error("[cron auto-close] could not list stale events:", error);
    return NextResponse.json({ error: "Could not list live events." }, { status: 500 });
  }

  const closed: string[] = [];
  const failed: { id: string; error: string }[] = [];
  for (const ev of stale ?? []) {
    const result = await settleEvent(ev.id as string, ev.dj_id as string, {
      system: true,
    });
    if (result.ok) {
      closed.push(ev.id as string);
    } else {
      failed.push({ id: ev.id as string, error: result.error });
      console.error(`[cron auto-close] ${ev.id} could not close: ${result.error}`);
    }
  }

  console.info(
    `[cron auto-close] closed ${closed.length}/${(stale ?? []).length} stale event(s)`
  );
  return NextResponse.json({ ok: true, closed: closed.length, failed });
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
