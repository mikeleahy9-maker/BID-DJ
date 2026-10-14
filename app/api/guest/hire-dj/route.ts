import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { djBookingRequestEmail, sendEmail } from "@/lib/email";

/**
 * POST /api/guest/hire-dj
 *
 * Sends a guest's booking enquiry to the DJ/Band by email. The guest fills the
 * "Book This DJ/Band" form on an event page; we validate it, resolve the DJ's
 * address, and deliver the details to their inbox with Reply-To set to the guest
 * so the DJ can answer with one tap.
 *
 * Body: { djId, eventId?, name, email, phone?, date, type, message? }
 *
 * `eventId` is optional context. When present it is checked against `djId`, so a
 * signed-in guest cannot aim a request at an arbitrary DJ of their choosing.
 *
 * Responses:
 *   200 { ok: true }   — the request was emailed to the DJ
 *   4xx/5xx { error }  — validation failed, DJ unreachable, or send failed
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const MAX_NAME = 120;
const MAX_PHONE = 40;
const MAX_TYPE = 60;
const MAX_MESSAGE = 2000;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const djId = String(body.djId ?? "").trim();
  const eventId = String(body.eventId ?? "").trim();
  const name = String(body.name ?? "").trim().slice(0, MAX_NAME);
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = String(body.phone ?? "").trim().slice(0, MAX_PHONE);
  const date = String(body.date ?? "").trim();
  const type = String(body.type ?? "").trim().slice(0, MAX_TYPE);
  const message = String(body.message ?? "").trim().slice(0, MAX_MESSAGE);

  if (!UUID_RE.test(djId)) {
    return NextResponse.json({ error: "Invalid DJ." }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }
  if (!date) {
    return NextResponse.json({ error: "Please select an event date." }, { status: 400 });
  }
  if (!type) {
    return NextResponse.json({ error: "Please select an event type." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Optional event context: it must belong to the DJ being hired, so a guest
  // cannot repoint the request at a DJ they picked themselves.
  let eventName: string | null = null;
  if (eventId) {
    if (!UUID_RE.test(eventId)) {
      return NextResponse.json({ error: "Invalid event." }, { status: 400 });
    }
    const { data: event } = await admin
      .from("events")
      .select("id, name, dj_id")
      .eq("id", eventId)
      .maybeSingle();
    if (!event || event.dj_id !== djId) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }
    eventName = event.name ?? null;
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("email, act_name, display_name, first_name, last_name")
    .eq("id", djId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "That DJ could not be found." }, { status: 404 });
  }

  // profiles.email can be blank on older accounts; auth is the source of truth.
  let djEmail = profile.email ?? null;
  if (!djEmail) {
    const { data: authUser } = await admin.auth.admin.getUserById(djId);
    djEmail = authUser?.user?.email ?? null;
  }
  if (!djEmail) {
    return NextResponse.json(
      { error: "This DJ can't be reached by email right now. Try again later." },
      { status: 422 }
    );
  }

  const djName =
    profile.act_name ||
    profile.display_name ||
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    "there";

  const delivery = await sendEmail({
    to: djEmail,
    replyTo: email,
    ...djBookingRequestEmail({
      djName,
      guestName: name,
      guestEmail: email,
      guestPhone: phone,
      eventDate: date,
      eventType: type,
      message,
      eventName,
    }),
  });

  if (!delivery.ok) {
    console.error("[hire-dj] could not send the booking request:", delivery.error);
    return NextResponse.json(
      { error: "We couldn't send your request. Please try again in a moment." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
