"use client";

import { FormEvent, useState } from "react";
import { Field, FieldRow, Input } from "@/components/ui/input";
import { useToast } from "./use-toast";

/**
 * DJ / Band signup form with the $50 activation flow.
 * Faithful port of screen-dj-signup. Stripe will own the payment once integrated.
 */

export default function DJSignupForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [actName, setActName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [city, setCity] = useState("");
  const [card, setCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { show, toastNode } = useToast();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !actName.trim() || !email.trim()) {
      setError("Please fill in the required account fields.");
      return;
    }
    setError(null);
    show("✓ Account activated! $50 charged — welcome aboard");
  };

  return (
    <>
      <div className="mb-5 rounded-xl border border-neon-3/25 bg-gradient-to-br from-neon-3/10 to-[#ff8800]/10 p-5 text-center">
        <div className="mb-1.5 text-[28px]" aria-hidden>
          🎛️
        </div>
        <div className="mb-1 font-display text-[22px] tracking-[2px] text-neon-3">
          $50 Account Activation
        </div>
        <div className="text-xs leading-[1.6] text-muted">
          One-time fee · Unlimited events · DJ earns 20% · Organizer gets 70% ·
          BidaBeat takes 10% · Full payout dashboard
        </div>
      </div>

      <form className="mb-3.5 flex flex-col gap-3.5" onSubmit={handleSubmit} noValidate>
        <FieldRow>
          <Field label="First Name" className="flex-1">
            <Input
              placeholder="First"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </Field>
          <Field label="Last Name" className="flex-1">
            <Input
              placeholder="Last"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </Field>
        </FieldRow>

        <Field label="Act / Stage Name">
          <Input
            placeholder="e.g. DJ Phantom, The Static Kings..."
            value={actName}
            onChange={(e) => setActName(e.target.value)}
          />
        </Field>

        <Field label="Email">
          <Input
            type="email"
            placeholder="you@email.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field label="Password">
          <Input
            type="password"
            placeholder="Choose a strong password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        <Field label="City / Market">
          <Input
            placeholder="e.g. Chicago, IL"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </Field>

        <div className="my-5 h-px bg-edge" />

        <div className="font-display text-base tracking-[1.5px] text-neon-3">
          Activation Payment
        </div>

        <Field label="Card Number">
          <Input
            placeholder="•••• •••• •••• ••••"
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

        <p className="mt-2 text-center text-[10px] leading-[1.6] text-muted">
          $50 charged once at signup · Your card is then saved for payout
          purposes
          <br />
          Processed securely via Stripe · No recurring charges
        </p>

        {error && <p className="text-center text-xs text-neon-2">{error}</p>}

        <button
          type="submit"
          className="mt-1 w-full cursor-pointer rounded-[10px] bg-gradient-to-br from-neon-3 to-[#ff8800] px-4 py-[15px] font-display text-[18px] tracking-[2px] text-bg shadow-[0_0_20px_rgba(255,230,0,0.2)] transition active:scale-[0.99]"
        >
          ACTIVATE ACCOUNT — $50 →
        </button>
      </form>

      <p className="mt-3 text-center text-[11px] leading-[1.6] text-muted">
        By signing up you agree to BidaBeat&apos;s terms of service.
        <br />
        The $50 fee is non-refundable once your account is activated.
      </p>

      {toastNode}
    </>
  );
}