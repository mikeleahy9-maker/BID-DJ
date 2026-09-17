"use client";

import { FormEvent, useState } from "react";
import { Field, FieldRow, Input } from "@/components/ui/input";
import { useToast } from "./use-toast";

/**
 * Guest (no-account) entry form — faithful port of screen-guest-auth.
 */

export default function GuestAuthForm() {
  const [name, setName] = useState("");
  const [card, setCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { show, toastNode } = useToast();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !card.trim()) {
      setError("Please enter your name and card number.");
      return;
    }
    setError(null);
    show("✓ You're in! (Card saved for tonight)");
  };

  return (
    <>
      <form className="mb-3.5 flex flex-col gap-3.5" onSubmit={handleSubmit} noValidate>
        <Field label="Name (shown to DJ)">
          <Input
            placeholder="Your first name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field label="Credit Card">
          <Input
            placeholder="Card number"
            autoComplete="cc-number"
            value={card}
            onChange={(e) => setCard(e.target.value)}
          />
        </Field>

        <FieldRow>
          <Field label="Expiry" className="flex-1">
            <Input
              placeholder="MM/YY"
              autoComplete="cc-exp"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
            />
          </Field>
          <Field label="CVV" className="flex-1">
            <Input
              placeholder="•••"
              autoComplete="cc-csc"
              value={cvv}
              onChange={(e) => setCvv(e.target.value)}
            />
          </Field>
        </FieldRow>

        {error && <p className="text-center text-xs text-neon-2">{error}</p>}

        <button
          type="submit"
          className="mt-1 w-full cursor-pointer rounded-[10px] bg-gradient-to-br from-neon-2 to-[#cc1155] px-4 py-[15px] font-display text-[18px] tracking-[2px] text-white shadow-[0_0_20px_rgba(255,45,120,0.25)] transition active:scale-[0.99]"
        >
          ENTER THE NIGHT →
        </button>

        <p className="mt-2 text-center text-[10px] leading-[1.6] text-muted">
          Your card is only charged when you buy credits. No hidden fees.
        </p>
      </form>

      {toastNode}
    </>
  );
}