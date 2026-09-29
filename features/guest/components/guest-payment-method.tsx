"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CardSetupForm } from "@/features/payments/card-setup-form";
import { PageContainer } from "@/components/layout/page-container";
import { useToast } from "@/components/ui/use-toast";

/**
 * GuestPaymentMethod — "Payment Methods" in the guest account dashboard.
 *
 * Shows the card currently on file and lets the guest replace it. The new card
 * goes through the same SetupIntent flow as signup: CardSetupForm collects the
 * card + billing address, then confirm-card writes the new payment method to
 * the profile. After a successful swap the dashboard refreshes.
 */
export function GuestPaymentMethod({
  card,
}: {
  card: {
    brand: string | null;
    last4: string | null;
    expMonth: number | null;
    expYear: number | null;
    saved: boolean;
  };
}) {
  const router = useRouter();
  const { show, toastNode } = useToast();

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  const cardLabel = (() => {
    const brand = card.brand ? card.brand.replace(/_/g, " ").toUpperCase() : "Card";
    const last4 = card.last4 ?? "****";
    if (!card.expMonth || !card.expYear) return `${brand} •••• ${last4}`;
    const exp = `${String(card.expMonth).padStart(2, "0")}/${String(card.expYear).slice(-2)}`;
    return `${brand} •••• ${last4} · ${exp}`;
  })();

  const handleSaved = async ({
    setupIntentId,
  }: {
    setupIntentId: string;
    billing: {
      name: string;
      line1: string;
      line2: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    } | null;
  }) => {
    setSaving(true);
    try {
      const res = await fetch("/api/guest/confirm-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupIntentId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? "Could not save your card. Please try again.");
      }
      show("Payment method updated");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      show(
        err instanceof Error ? err.message : "Could not save your card. Please try again."
      );
      setClientSecret(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageContainer className="py-8 md:py-14">
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-5 cursor-pointer border-none bg-transparent text-xs text-muted transition hover:text-neon"
        >
          ← Back to dashboard
        </button>

        <div className="grid gap-8 md:grid-cols-[1fr_1.2fr] md:items-start md:gap-12">
          {/* Left — copy + current card */}
          <div className="md:pt-2">
            <div className="mb-5">
              <div className="mb-2 flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full bg-neon"
                  aria-hidden
                />
                <span className="text-[11px] uppercase tracking-[2px] text-neon">
                  Payment method
                </span>
              </div>
              <h1 className="font-display text-[28px] tracking-[2px] md:text-4xl">
                Your saved card
              </h1>
              <p className="mt-2 text-[13px] leading-[1.7] text-muted">
                You&apos;re only charged when you buy credits. Add a new card to
                replace the one below — purchases go to the newest saved card.
              </p>
            </div>

            {card.saved ? (
              <div className="mb-5 flex items-center justify-between rounded-xl border border-edge bg-surface px-4 py-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-edge bg-surface-2 text-lg" aria-hidden>
                    💳
                  </span>
                  <div>
                    <div className="text-sm font-semibold">{cardLabel}</div>
                    <div className="mt-0.5 text-[11px] text-muted">
                      Saved with Stripe
                    </div>
                  </div>
                </div>
                <span className="rounded-full border border-neon/40 bg-neon/5 px-2.5 py-1 text-[10px] uppercase tracking-[1px] text-neon">
                  Active
                </span>
              </div>
            ) : null}

            <ul className="hidden space-y-3 text-sm text-foreground/80 md:block">
              <li className="flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-edge bg-surface-2 text-base" aria-hidden>
                  🔒
                </span>
                Card details are stored securely with Stripe — never on our server
              </li>
              <li className="flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-edge bg-surface-2 text-base" aria-hidden>
                  💸
                </span>
                You&apos;re only charged when you buy credits
              </li>
              <li className="flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-edge bg-surface-2 text-base" aria-hidden>
                  ⚡
                </span>
                The new card takes over immediately after you save it
              </li>
            </ul>
          </div>

          {/* Right — replace-card form */}
          <div className="rounded-xl border border-edge bg-surface p-6 md:p-8">
            <div className="mb-3 text-[11px] uppercase tracking-[2px] text-muted">
              {card.saved ? "Replace card" : "Save a card"}
            </div>

            {loadError ? (
              <div className="rounded-lg border border-edge bg-surface-2 px-4 py-3 text-center text-xs text-neon-2">
                {loadError}
              </div>
            ) : (
              <CardSetupForm
                clientSecret={clientSecret}
                returnUrl={undefined}
                elementClassName=""
                collectBillingDetails
                submitLabel={card.saved ? "REPLACE CARD →" : "SAVE CARD →"}
                onSaved={handleSaved}
                footer="Your card is saved securely via Stripe. You are only charged when you buy credits."
              />
            )}

            {saving && (
              <p className="mt-3 text-center text-xs text-muted">
                Saving your new card…
              </p>
            )}

            <div className="mt-4 border-t border-edge pt-4 md:hidden">
              <ul className="space-y-3 text-sm text-foreground/80">
                <li className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-edge bg-surface-2 text-base" aria-hidden>
                    🔒
                  </span>
                  Card details are stored securely with Stripe — never on our server
                </li>
                <li className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-edge bg-surface-2 text-base" aria-hidden>
                    💸
                  </span>
                  You&apos;re only charged when you buy credits
                </li>
                <li className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-edge bg-surface-2 text-base" aria-hidden>
                    ⚡
                  </span>
                  The new card takes over immediately after you save it
                </li>
              </ul>
            </div>
          </div>
        </div>
      </PageContainer>
      {toastNode}
    </>
  );
}