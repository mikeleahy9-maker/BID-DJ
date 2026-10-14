import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail, eventAutoCloseWarningEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/app-url";

/**
 * POST /api/cron/auto-close-warning
 *
 * The 30-hour heads-up: emails the DJ of every event that has been live for at
 * least 30 hours (but not yet past the 36-hour auto-close) and has not been
 * warned before. Sends once per event -- auto_close_warned_at is only stamped
 * after a successful send, so a transient SendGrid failure retries next hour
 * instead of being lost, while a configured outage cannot page the DJ repeatedly.
 *
 * Auth mirrors the other cron routes: a shared secret forwarded by the pg_cron
 * job (bidabeat-auto-close-warning, hourly), verified constant-time.
 */
const AUTO_CLOSE_AFTER_MS = 36 * 60 * 60 * 1000;
const WARN_AFTER_MS = 30 * 60 * 60 * 1000;

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
  const now = Date.now();
  const warnBefore = new Date(now - WARN_AFTER_MS).toISOString();
  const closeAfter = new Date(now - AUTO_CLOSE_AFTER_MS).toISOString();

  // Live, at least 30h old, not yet past the 36h close point, never warned.
  // Anything already past 36h is the auto-close sweep's job -- warning about it
  // would arrive after the fact.
  const { data: events, error } = await admin
    .from("events")
    .select("id, name, dj_id, live_at")
    .eq("status", "live")
    .not("live_at", "is", null)
    .is("auto_close_warned_at", null)
    .lte("live_at", warnBefore)
    .gt("live_at", closeAfter);

  if (error) {
    console.error("[cron auto-close-warning] could not list events:", error);
    return NextResponse.json({ error: "Could not list live events." }, { status: 500 });
  }

  const warned: string[] = [];
  const failed: { id: string; error: string }[] = [];
  const queueUrl = `${getAppUrl()}/dj/queue`;

  for (const ev of events ?? []) {
    const eventId = ev.id as string;
    const liveAt = new Date(ev.live_at as string).getTime();
    const hoursRemaining = Math.max(
      1,
      Math.round((liveAt + AUTO_CLOSE_AFTER_MS - now) / (60 * 60 * 1000))
    );

    const { data: profile } = await admin
      .from("profiles")
      .select("email, act_name, display_name, first_name, last_name")
      .eq("id", ev.dj_id as string)
      .maybeSingle();

    let email = profile?.email ?? null;
    if (!email) {
      // profiles.email can be blank on older accounts; auth is the source of truth.
      const { data: authUser } = await admin.auth.admin.getUserById(ev.dj_id as string);
      email = authUser?.user?.email ?? null;
    }

    if (!email) {
      // Nothing actionable, and no point re-checking every hour forever.
      await admin
        .from("events")
        .update({ auto_close_warned_at: new Date().toISOString() })
        .eq("id", eventId);
      failed.push({ id: eventId, error: "DJ has no email on file." });
      continue;
    }

    const djName =
      profile?.act_name ||
      profile?.display_name ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
      "there";

    const delivery = await sendEmail({
      to: email,
      ...eventAutoCloseWarningEmail({
        djName,
        eventName: ev.name as string,
        hoursRemaining,
        queueUrl,
      }),
    });

    if (!delivery.ok) {
      // Not stamped: the hourly run will try again (nothing was delivered).
      failed.push({ id: eventId, error: delivery.error ?? "Email send failed." });
      continue;
    }

    await admin
      .from("events")
      .update({ auto_close_warned_at: new Date().toISOString() })
      .eq("id", eventId);
    warned.push(eventId);
  }

  console.info(
    `[cron auto-close-warning] warned ${warned.length}/${(events ?? []).length} event(s)`
  );
  return NextResponse.json({ ok: true, warned: warned.length, failed });
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
