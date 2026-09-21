/**
 * DJ route layout — desktop dashboard shell + access guard.
 *
 * Guards every /dj/* page server-side:
 *  1. Not signed in            → redirect to /dj-login
 *  2. Role not dj/helper       → redirect to /events
 *  3. DJ hasn't paid the $50
 *     activation fee           → dashboard stays locked: only the
 *                                activation banner + locked screen render
 *                                until profiles.activated = true
 *                                (flipped by the Stripe webhook).
 */

import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server";
import { DjShell } from "@/features/dj/components/dj-shell";
import { DJActivationBanner } from "@/features/dj/components/dj-activation-banner";

export const metadata = {
  title: "DJ Dashboard",
  description: "BidaBeat DJ dashboard — manage gigs, queue, and earnings.",
};

function ActivationGate({ name }: { name: string }) {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-edge bg-surface p-8 text-center">
      <div className="mb-3 text-[32px]" aria-hidden>
        🔒
      </div>
      <h2 className="mb-2 font-display text-[20px] tracking-[1px] text-foreground">
        {name}&apos;s dashboard is locked
      </h2>
      <p className="text-[13px] leading-[1.7] text-muted">
        Your DJ account is created but not activated yet. Pay the one-time{" "}
        <span className="font-bold text-neon-3">$50 activation fee</span> above to
        start running events and receiving earnings. The fee unlocks instantly once
        payment clears.
      </p>
    </div>
  );
}

export default async function DJLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/dj-login");
  }

  const supabase = await getSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, activated, act_name, first_name, last_name")
    .eq("id", user.id)
    .single();

  const role = profile?.role as string | undefined;
  if (role !== "dj" && role !== "helper") {
    redirect("/events");
  }

  const activated = profile?.activated ?? false;
  const locked = role === "dj" && !activated;
  const profileName =
    profile?.act_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    "DJ";
  const accountLabel = role === "helper" ? "helper account" : "owner account";
  const displayName =
    profile?.act_name || profile?.first_name || profile?.last_name || "Your";

  return (
    <DjShell profileName={profileName} accountLabel={accountLabel}>
      {locked && <DJActivationBanner />}
      {locked ? <ActivationGate name={displayName} /> : children}
    </DjShell>
  );
}