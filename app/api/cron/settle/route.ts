import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { retryOutstandingSettlements } from "@/lib/settlement";

/**
 * POST /api/cron/settle
 *
 * Scheduled sweep that moves money for settled but unpaid events. Configuring
 * the schedule is Supabase's job (pg_cron / net.http_post, once a day), not
 * ours: Stripe holds this test platform's charges in `pending` until they
 * settle days later, and a transfer against funds that have not become
 * `available` is rejected. `/end` only books the settlement; this route -- or
 * the `balance.available` webhook firing early -- is what actually transfers
 * the shares.
 *
 * Auth: the caller's environment on the other side of the URL cannot sign
 * requests on our behalf, so the secret the cron job forwards is a shared
 * convenience token rather than a per-user credential. It is verified with a
 * constant-time compare, and failing it returns 401 without doing work.
 *
 * Idempotent: retryOutstandingSettlements() only touches pending/held legs
 * (never `failed`, which needs a human) and advances them one idempotency-key
 * step at a time, so overlapping runs cannot pay anyone twice.
 */
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

  const released = await retryOutstandingSettlements();
  console.info(`[cron settle] sweep complete: ${released} share(s) released`);
  return NextResponse.json({ ok: true, released });
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}