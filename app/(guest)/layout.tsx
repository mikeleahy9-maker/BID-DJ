/**
 * Guest route group layout.
 * Single topbar: BID-A-BEAT left, guest name chip + Log Out at right end -
 * matching #screen-guest. Exactly one <header> (this one); guest pages
 * should not render their own topbars.
 *
 * Access guard: unauthenticated users are sent to /login, and guests with no
 * saved card are shown the card-save gate instead of any guest page — the
 * dashboard is locked until a payment method exists.
 */

import React from "react";
import { redirect } from "next/navigation";
import {
  getCurrentUser,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import { AppHeader } from "@/components/layout/app-header";
import { GuestHeaderActions } from "@/features/guest/components/guest-header-actions";
import { GuestCardGate } from "@/features/guest/components/guest-card-gate";

interface LayoutProps {
  children: React.ReactNode;
}

export const metadata = {
  title: "BidaBeat - Guest Dashboard",
  description: "Guest dashboard",
};

export default async function GuestLayout({ children }: LayoutProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const supabase = await getSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, stripe_payment_method_id")
    .eq("id", user.id)
    .single();

  const name =
    profile?.first_name ||
    profile?.last_name ||
    (user.email ? user.email.split("@")[0] : "") ||
    "Guest";

  const hasSavedCard = Boolean(profile?.stripe_payment_method_id);

  return (
    <>
      <AppHeader navItems={[]} rightSlot={<GuestHeaderActions name={name} />} />
      <main className="flex-1">{hasSavedCard ? children : <GuestCardGate />}</main>
    </>
  );
}
