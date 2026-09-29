"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Modal } from "@/components/ui/modal";
import { CREDIT_PACKS, type CreditPack } from "@/lib/stripe";
import { STRIPE_PK } from "@/lib/stripe-client";

/**
 * GuestBuyModal - the prototype's BUY CREDITS modal, backed by real payments.
 *
 * Charges the card the guest saved at signup, in place, so there is no redirect
 * to hosted Checkout. If the bank asks for 3-D Secure, Stripe.js takes over in
 * this same modal and the purchase is finalized when it completes.
 *
 * Packs are imported from the server-authoritative CREDIT_PACKS catalog rather
 * than redefined here, so the amount shown cannot drift from the amount
 * charged. The API re-resolves the pack by id regardless.
 *
 * Credits are granted server-side only, keyed on the PaymentIntent id, so a
 * replayed webhook or a retried finalize cannot double-credit.
 */

interface Pack extends CreditPack {
  price: string;
  bonus: number;
  badgeColor: string;
}

const PACKS: Pack[] = CREDIT_PACKS.map((p) => ({
  ...p,
  price: formatUsd(p.revenueCents),
  bonus: p.credits - Math.round(p.revenueCents / 100),
  badgeColor:
    p.id === "pack_11"
      ? "text-neon-3"
      : p.id === "pack_23"
        ? "text-neon-2"
        : "text-muted",
}));

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function GuestBuyModal({
  open,
  onClose,
  eventId,
  onPurchased,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  onPurchased: (creditsAdded: number) => void;
}) {
  const [selected, setSelected] = useState<Pack>(PACKS[1]);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reused across retries of the same attempt and sent as Stripe's
  // idempotency key, so a double-click cannot charge twice.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  const select = (pack: Pack) => {
    setSelected(pack);
    setError(null);
    // A different pack is a different charge, so it needs a fresh key.
    setRequestId(crypto.randomUUID());
  };

  const confirm = async () => {
    setError(null);
    setPurchasing(true);
    try {
      const res = await fetch("/api/guest/buy-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, packId: selected.id, requestId }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; creditsGranted?: number; requiresAction?: boolean; clientSecret?: string; error?: string }
        | null;

      if (!res.ok) {
        setError(body?.error ?? "Could not take that payment.");
        return;
      }

      if (body?.requiresAction && body.clientSecret) {
        await complete3DS(body.clientSecret);
        return;
      }

      onPurchased(body?.creditsGranted ?? selected.credits);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setPurchasing(false);
    }
  };

  /**
   * Bank-authenticated payment (3-D Secure). Stripe.js shows the challenge in
   * this modal, then we ask the server to record the sale — the server reads
   * the intent status from Stripe rather than trusting this client.
   */
  const complete3DS = async (clientSecret: string) => {
    if (!STRIPE_PK) {
      setError("Payments aren't configured. Please try again later.");
      return;
    }
    const stripe = await loadStripe(STRIPE_PK);
    if (!stripe) {
      setError("Could not load the payment form. Please try again.");
      return;
    }

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      clientSecret,
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Your bank declined the payment.");
      return;
    }
    if (!paymentIntent?.id) {
      setError("Your bank is still processing this payment. Please try again.");
      return;
    }

    const res = await fetch("/api/guest/buy-credits/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
    });
    const body = (await res.json().catch(() => null)) as
      | { ok?: boolean; creditsGranted?: number; error?: string }
      | null;

    if (!res.ok || !body?.ok) {
      setError(body?.error ?? "Your bank is still processing this payment. Please try again.");
      return;
    }

    onPurchased(body.creditsGranted ?? selected.credits);
  };

  return (
    <Modal open={open} onClose={onClose} sheet>
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-5 top-4 cursor-pointer border-none bg-transparent text-xl text-muted"
      >
        ✕
      </button>
      <div className="font-display text-[30px] tracking-[2px]">Buy Credits</div>
      <div className="mb-4 mt-1.5 text-xs text-muted">
        Credits let you request and bid songs up the queue
      </div>
      <div className="mb-3.5 text-center text-[11px] tracking-[1px] text-neon">
        Buy more, get bonus credits free · $1.00 per credit
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2.5">
        {PACKS.map((p) => {
          const isSel = p.credits === selected.credits;
          return (
            <button
              key={p.id}
              onClick={() => select(p)}
              className={`cursor-pointer rounded-[10px] border px-3 py-4 text-center transition-all ${
                isSel
                  ? "border-neon bg-neon/5"
                  : "border-edge bg-surface-2"
              }`}
            >
              <div className="font-display text-[36px] leading-none text-neon">
                {p.credits}
              </div>
              {p.bonus > 0 && (
                <div className="my-0.5 text-[11px] font-bold tracking-[0.5px] text-neon-3">
                  +{p.bonus} FREE
                </div>
              )}
              <div className="mt-0.5 text-xs text-muted">{p.price}</div>
              {p.badge && (
                <div className={`mt-1 text-[10px] font-bold ${p.badgeColor ?? "text-neon-2"}`}>
                  {p.badge}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-neon-2/40 bg-neon-2/10 px-3 py-2 text-[11px] text-neon-2">
          {error}
        </div>
      )}

      <button
        onClick={confirm}
        disabled={purchasing}
        className="w-full cursor-pointer rounded-[10px] border-none bg-neon-2 px-4 py-3.5 text-[15px] font-bold tracking-[1px] text-white disabled:opacity-60"
      >
        {purchasing ? "REDIRECTING…" : `PAY ${selected.price}`}
      </button>

      <div className="mt-3 rounded-lg border border-neon/10 bg-neon/5 px-3 py-2.5 text-[11px] leading-[1.6] text-muted">
        💡 Any unused credits at the end of the event are automatically donated
        to the event organizer — they are not refunded to you. Credits are
        $1.00 each, plus free bonus credits on larger packs. The money collected
        is split 70% to the organizer, 20% to the DJ/Band and 10% to BidaBeat.
        DJ tips go 100% to the DJ/Band.
      </div>
      <div className="mt-2 text-center text-[10px] text-muted">
        You are charged once, at purchase. Nothing else is charged at the end of
        the event.
      </div>
    </Modal>
  );
}