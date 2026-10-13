import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await getSupabaseServerClient();

  let body: { eventId: string; amountCents: number; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { eventId, amountCents, message } = body;

  if (!eventId || typeof amountCents !== "number" || amountCents <= 0) {
    return NextResponse.json({ error: "eventId and amountCents (>0) required" }, { status: 400 });
  }

  const amount = amountCents / 100;
  const cleanedMessage = typeof message === "string" ? message.trim().slice(0, 140) : "";
  const safeMessage = cleanedMessage ? cleanedMessage : null;

  const { data: attendee, error } = await supabase.rpc("gift_attendee_credits", {
    p_event_id: eventId,
    p_amount: amount,
    p_message: safeMessage,
  });

  if (error) {
    console.error("gift_attendee_credits error:", error);
    return NextResponse.json({ error: "Could not process gift" }, { status: 500 });
  }

  if (!attendee) {
    return NextResponse.json({ error: "Insufficient credits or not an attendee" }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    newBalance: Number(attendee.credit_balance),
  });
}