"use client";

import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Amber banner shown to DJs who registered but haven't paid the $50
 * activation fee yet. Starts Stripe Checkout inline.
 */
export function DJActivationBanner() {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    setPaying(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");

      const checkout = await fetch("/api/checkout/dj-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const json = await checkout.json().catch(() => ({}));
      if (!checkout.ok || !json.url) {
        throw new Error(json.error ?? "Could not start payment.");
      }
      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start payment.");
      setPaying(false);
    }
  };

  return (
    <div className="mb-5 rounded-xl border border-neon-3/40 bg-gradient-to-r from-neon-3/15 to-orange-400/10 px-4 py-3">
      <div className="flex flex-wrap items-center justify-center gap-3 text-center">
        <p className="text-[12px] font-semibold tracking-[0.5px] text-foreground">
          ⚠️ Your account isn&apos;t activated yet — pay the one-time $50 fee to
          list events and receive earnings.
        </p>
        <button
          type="button"
          disabled={paying}
          onClick={handlePay}
          className="rounded-full border border-neon-3 bg-neon-3/10 px-4 py-1.5 text-xs font-bold text-neon-3 transition hover:bg-neon-3/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {paying ? "Loading checkout…" : "PAY $50 & ACTIVATE →"}
        </button>
      </div>
      {error && (
        <p className="mt-1 text-center text-[11px] text-neon-2">
          {error} — try again later.
        </p>
      )}
    </div>
  );
}