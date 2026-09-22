import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * POST /api/guest/save-card
 * Body: (none — auth comes from the session)
 * Response: { client_secret }
 *
 * Mints a Stripe SetupIntent for the signed-in user so the browser can collect
 * card details with Stripe Elements. Ensures the user has a Stripe Customer
 * first (created on signup, but the gate can also be reached by an account
 * that was created before the card step ran).
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    let customerId: string | null = profile?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: user.email ?? undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
      if (updateError) throw updateError;
    }

    const setupIntent = await getStripe().setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      metadata: { user_id: user.id },
    });

    return NextResponse.json({ client_secret: setupIntent.client_secret });
  } catch (err) {
    console.error("[save-card] failed:", err);
    return NextResponse.json(
      { error: "Could not start the payment form. Please try again." },
      { status: 500 }
    );
  }
}
