"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CardSetupForm } from "@/features/payments/card-setup-form";
import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * GuestCardGate — shown by the (guest) layout when the signed-in user has no
 * saved card. Blocks ALL guest pages (dashboard, request, join, events) until
 * a card is saved. After saving, the profile is written synchronously and the
 * layout re-renders into the real page.
 */
export function GuestCardGate() {
  const router = useRouter();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function prepare() {
      try {
        const res = await fetch("/api/guest/save-card", { method: "POST" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.error ?? "Could not start the payment form.");
        }
        if (!cancelled) setClientSecret(json.client_secret);
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error
              ? err.message
              : "Could not start the payment form."
          );
        }
      }
    }

    prepare();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaved = async ({ setupIntentId }: { setupIntentId: string }) => {
    const res = await fetch("/api/guest/confirm-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setupIntentId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error ?? "Could not save your card. Please try again.");
    }
    router.refresh();
  };

  const handleLogout = async () => {
    setSigningOut(true);
    await getSupabaseClient().auth.signOut();
    router.push("/");
    router.refresh();
  };

  // SSR-safe: undefined on the server, real origin after hydration.
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col px-4 py-10 md:px-6 md:py-16">
      <div className="grid gap-8 md:grid-cols-[1fr_1.2fr] md:items-start md:gap-12">
        {/* Left — copy */}
        <div className="md:pt-2">
          <div className="mb-4 flex items-center gap-3">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full bg-neon-3"
              aria-hidden
            />
            <span className="text-[11px] uppercase tracking-[2px] text-neon">
              One step left
            </span>
          </div>

          <h1 className="mb-3 font-display text-[30px] leading-tight tracking-[2px] text-foreground md:text-[34px]">
            Save a payment
            <br />
            method
          </h1>
          <p className="mb-6 text-[13px] leading-[1.7] text-muted">
            A card is required to unlock your dashboard. It&apos;s saved
            securely with Stripe —{" "}
            <span className="text-foreground">
              you are only charged when you buy credits
            </span>
            .
          </p>

          <ul className="space-y-3 text-sm text-foreground/80">
            <li className="flex items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-edge bg-surface-2 text-base" aria-hidden>
                🎟️
              </span>
              Join tonight&apos;s event with a code
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-edge bg-surface-2 text-base" aria-hidden>
                🎵
              </span>
              Request songs and bid on the queue
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-edge bg-surface-2 text-base" aria-hidden>
                💸
              </span>
              Tip the DJ and gift songs to friends
            </li>
          </ul>
        </div>

        {/* Right — card form */}
        <div className="rounded-xl border border-edge bg-surface p-6 md:p-8">
          {loadError ? (
            <div className="rounded-lg border border-edge bg-surface-2 px-4 py-3 text-center text-xs text-neon-2">
              {loadError}
            </div>
          ) : (
            <CardSetupForm
              clientSecret={clientSecret}
              returnUrl={origin ? `${origin}/dashboard` : undefined}
              elementClassName=""
              onSaved={handleSaved}
              footer="Your card is saved securely via Stripe. You are only charged when you buy credits."
            />
          )}
        </div>
      </div>

      <button
        onClick={handleLogout}
        disabled={signingOut}
        className="mt-8 cursor-pointer text-center text-xs text-muted transition hover:text-neon-2"
      >
        {signingOut ? "Signing out…" : "Log out and finish later"}
      </button>
    </div>
  );
}

export default GuestCardGate;