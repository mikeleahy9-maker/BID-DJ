/**
 * Guest route group layout.
 * Single topbar: BID-A-BEAT left, guest name chip + Log Out at right end -
 * matching #screen-guest. Exactly one <header> (this one); guest pages
 * should not render their own topbars.
 */

import React from "react";
import { redirect } from "next/navigation";
import {
  getCurrentUser,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import { AppHeader } from "@/components/layout/app-header";
import { GuestHeaderActions } from "@/features/guest/components/guest-header-actions";

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
    .select("first_name, last_name")
    .eq("id", user.id)
    .single();

  const name =
    profile?.first_name ||
    profile?.last_name ||
    (user.email ? user.email.split("@")[0] : "") ||
    "Guest";

  return (
    <>
      <AppHeader navItems={[]} rightSlot={<GuestHeaderActions name={name} />} />
      <main className="flex-1">{children}</main>
    </>
  );
}
