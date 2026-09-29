import {
  getCurrentUser,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import { GuestPaymentMethod } from "@/features/guest/components/guest-payment-method";

export const metadata = {
  title: "Payment Method",
  description: "View or change the card saved to your BidaBeat account.",
};

export const dynamic = "force-dynamic";

export default async function PaymentMethodPage() {
  const user = await getCurrentUser();
  const supabase = await getSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "card_brand, card_last4, card_exp_month, card_exp_year, stripe_payment_method_id"
    )
    .eq("id", user?.id ?? "")
    .maybeSingle();

  return (
    <GuestPaymentMethod
      card={{
        brand: profile?.card_brand ?? null,
        last4: profile?.card_last4 ?? null,
        expMonth: profile?.card_exp_month ?? null,
        expYear: profile?.card_exp_year ?? null,
        saved: Boolean(profile?.stripe_payment_method_id),
      }}
    />
  );
}