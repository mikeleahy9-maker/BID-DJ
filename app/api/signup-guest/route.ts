import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * POST /api/signup-guest
 * Body: { first_name, last_name, email, password }
 * Response: { userId, client_secret }
 *
 * Guest signup — creates the Supabase auth user, ensures a Stripe Customer,
 * and returns a SetupIntent client_secret for the browser to confirm with
 * Stripe Elements. No raw card data is ever sent to this server or stored.
 *
 * Idempotent by email: retries (e.g. a failed card attempt) reuse the
 * existing user + customer and just mint a fresh SetupIntent.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const firstName = String(body.first_name ?? "").trim();
  const lastName = String(body.last_name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!firstName || !lastName || !EMAIL_RE.test(email) || password.length < 6) {
    return NextResponse.json(
      { error: "Please fill in your first name, last name, email, and a 6+ character password." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  // ---- 1. Find or create the Supabase auth user (profile row via trigger) ----
  let userId: string;
  let customerId: string | null = null;

  const { data: existing } = await supabase
    .from("profiles")
    .select("id, stripe_customer_id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    userId = existing.id;
    customerId = existing.stripe_customer_id;
  } else {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { role: "guest", first_name: firstName, last_name: lastName },
    });

    if (createError) {
      // Race: someone else signed up with the same email between check & create.
      if (/already registered/i.test(createError.message)) {
        const { data: raced } = await supabase
          .from("profiles")
          .select("id, stripe_customer_id")
          .eq("email", email)
          .maybeSingle();
        if (raced) {
          userId = raced.id;
          customerId = raced.stripe_customer_id;
        } else {
          return NextResponse.json(
            { error: "This email is already registered. Please try other email addresses." },
            { status: 409 }
          );
        }
      } else {
        console.error("[signup-guest] auth createUser failed:", createError);
        return NextResponse.json(
          { error: "Could not create your account. Please try again." },
          { status: 400 }
        );
      }
    } else if (created.user) {
      userId = created.user.id;
    } else {
      return NextResponse.json(
        { error: "Could not create your account. Please try again." },
        { status: 500 }
      );
    }
  }

  // ---- 2. Ensure a Stripe Customer (persist the link immediately) ----
  if (!customerId) {
    const customer = await getStripe().customers.create({
      email,
      name: [firstName, lastName].filter(Boolean).join(" ").trim() || undefined,
      metadata: { user_id: userId },
    });
    customerId = customer.id;
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", userId);
    if (updateError) {
      console.error("[signup-guest] could not persist stripe_customer_id:", updateError);
    }
  }

  // ---- 3. SetupIntent for the browser to confirm (card saved via webhook) ----
  const setupIntent = await getStripe().setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
    metadata: { user_id: userId },
  });

  return NextResponse.json({
    userId,
    client_secret: setupIntent.client_secret,
  });
}