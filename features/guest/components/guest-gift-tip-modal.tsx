"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/use-toast";
import { STRIPE_PK } from "@/lib/stripe-client";

/**
 * GuestGiftTipModal - shared port of the prototype's DONATE (gift credits)
 * and TIP THE DJ/BAND modals. Preset amount pills + custom input, and an
 * optional message for tips.
 *
 * Tips are real: they charge the guest's saved card via /api/guest/tip, the DJ
 * receives the whole tip minus Stripe's processing fee, and an optional 3-D
 * Secure challenge is completed inline with Stripe.js. Gifting credits is still
 * a demo action (no charge) and is left as-is.
 */

type Kind = "gift" | "tip";

const PRESETS: Record<Kind, number[]> = {
  gift: [5, 10, 20, 50],
  tip: [2, 5, 10, 20],
};

export function GuestGiftTipModal({
  open,
  kind,
  eventId,
  onClose,
}: {
  open: boolean;
  kind: Kind | null;
  eventId: string;
  onClose: () => void;
}) {
  const { show, toastNode } = useToast();
  const isTip = kind === "tip";
  const presets = kind ? PRESETS[kind] : PRESETS.gift;

  const [amount, setAmount] = useState<number>(10);
  const [custom, setCustom] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reused across retries of the same attempt and sent as Stripe's idempotency
  // key, so a double-tap cannot tip twice. A new amount is a new charge, so it
  // gets a fresh key.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  const pick = (amt: number) => {
    setAmount(amt);
    setCustom("");
    setRequestId(crypto.randomUUID());
    setError(null);
  };

  const customChange = (v: string) => {
    setCustom(v);
    setAmount(parseFloat(v) || 0);
    setRequestId(crypto.randomUUID());
    setError(null);
  };

  const reset = () => {
    setCustom("");
    setMessage("");
    setAmount(10);
    setError(null);
    setRequestId(crypto.randomUUID());
  };

  const submit = async () => {
    if (!amount || amount < 1) {
      setError(`Minimum ${isTip ? "tip" : "donation"} is $1`);
      return;
    }

    if (!isTip) {
      // Gifting credits is still a demo action.
      onClose();
      reset();
      show(`🎁 $${amount.toFixed(2)} gifted to the event!`);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const amountCents = Math.round(amount * 100);
      const res = await fetch("/api/guest/tip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, amountCents, message, requestId }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; requiresAction?: boolean; clientSecret?: string; error?: string }
        | null;

      if (!res.ok) {
        setError(body?.error ?? "Could not take that payment.");
        return;
      }

      if (body?.requiresAction && body.clientSecret) {
        await complete3DS(body.clientSecret);
        return;
      }

      onClose();
      show(`🎛️ $${amount.toFixed(2)} tip sent${message ? ` — "${message.slice(0, 30)}"` : ""}!`);
      reset();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Bank-authenticated tip (3-D Secure). Stripe.js shows the challenge in this
   * modal, then the server re-reads the intent and books the tip — the client
   * never gets to claim a payment succeeded.
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
      setError("Your bank is still processing this tip. Please try again.");
      return;
    }

    const res = await fetch("/api/guest/tip/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
    });
    const body = (await res.json().catch(() => null)) as
      | { ok?: boolean; error?: string }
      | null;

    if (!res.ok || !body?.ok) {
      setError(body?.error ?? "Your bank is still processing this tip. Please try again.");
      return;
    }

    onClose();
    show(`🎛️ $${amount.toFixed(2)} tip sent${message ? ` — "${message.slice(0, 30)}"` : ""}!`);
    reset();
  };

  return (
    <>
      <Modal open={open} onClose={submitting ? () => {} : onClose} sheet>
        <button
          onClick={onClose}
          disabled={submitting}
          aria-label="Close"
          className="absolute right-5 top-4 cursor-pointer border-none bg-transparent text-xl text-muted disabled:opacity-40"
        >
          ✕
        </button>
        <div className="font-display text-[30px] tracking-[2px]">
          {isTip ? "🎛️ Tip the DJ/Band" : "🎁 Gift Credits to Event"}
        </div>
        <div className="mb-4 mt-1.5 text-xs text-muted">
          {isTip
            ? "Send cash directly to the performer. They'll see your name and message."
            : "Your donation goes directly to the event organizer. Choose an amount below or enter your own."}
        </div>

        {/* presets */}
        <div className="mb-3 flex gap-2">
          {presets.map((p) => {
            const isSelected = !custom && amount === p;
            return (
              <button
                key={p}
                onClick={() => pick(p)}
                disabled={submitting}
                className={`flex-1 cursor-pointer rounded-lg border px-1.5 py-2.5 text-[15px] font-bold transition-all disabled:opacity-60 ${
                  isSelected
                    ? isTip
                      ? "border-neon-2 bg-neon-2/10 text-neon-2"
                      : "border-accent bg-accent/10 text-accent"
                    : "border-edge bg-surface-2 text-foreground"
                }`}
              >
                ${p}
              </button>
            );
          })}
        </div>

        {/* custom amount */}
        <div className="mb-3.5 flex items-center gap-2 rounded-[10px] border border-edge bg-surface-2 px-4 py-2.5">
          <span className="text-[22px] font-bold text-muted">$</span>
          <input
            type="number"
            min={1}
            value={custom || (amount ? amount : "")}
            onChange={(e) => customChange(e.target.value)}
            disabled={submitting}
            placeholder="0.00"
            className="w-full border-none bg-transparent font-display text-[28px] font-bold tracking-[2px] text-foreground outline-none placeholder:text-muted"
          />
        </div>

        {!isTip ? (
          <div className="mb-4 text-center text-[11px] text-muted">
            100% goes to the event — this is not converted to credits
          </div>
        ) : (
          <div className="mb-4">
            <label className="mb-1.5 block text-[11px] text-muted">
              Leave a message (optional)
            </label>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={submitting}
              placeholder="You're killing it tonight! 🔥"
              maxLength={80}
              className="w-full rounded-lg border border-edge bg-surface-2 px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-neon placeholder:text-muted"
            />
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-lg border border-neon-2/40 bg-neon-2/10 px-3 py-2 text-[11px] text-neon-2">
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={submitting}
          className={`w-full cursor-pointer rounded-[10px] border-none px-4 py-3.5 text-[15px] font-bold tracking-[1px] text-white disabled:opacity-60 ${
            isTip
              ? "bg-[linear-gradient(135deg,#ff2d78,#cc1155)]"
              : "bg-[linear-gradient(135deg,#a855f7,#7c3aed)]"
          }`}
        >
          {submitting
            ? "SENDING…"
            : isTip
              ? "SEND TIP 🎛️"
              : "SEND GIFT 🎁"}
        </button>
        <div className="mt-2.5 text-center text-[10px] text-muted">
          {isTip
            ? "Charged to your saved card. The DJ receives the full tip minus card processing fees."
            : "Demo mode — no real charges"}
        </div>
      </Modal>
      {toastNode}
    </>
  );
}
