"use client";

import { FormEvent, useState } from "react";
import { Field, FieldRow, Input } from "@/components/ui/input";
import { useToast } from "./use-toast";

/**
 * Guest account signup form — faithful port of screen-create.
 * Card fields are captured for fidelity; Stripe Elements will replace them later.
 */

export default function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [card, setCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { show, toastNode } = useToast();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in your name, email, and password.");
      return;
    }
    setError(null);
    show("✓ Account created! (Supabase auth — coming soon)");
  };

  return (
    <>
      <form className="mb-3.5 flex flex-col gap-3.5" onSubmit={handleSubmit} noValidate>
        <Field label="Name">
          <Input
            placeholder="Your name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
            placeholder="Choose a password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        <Field label="Credit Card">
          <Input
            placeholder="Card number (saved for events)"
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
          className="mt-1 w-full cursor-pointer rounded-[10px] bg-gradient-to-br from-neon to-[#00c9b1] px-4 py-[15px] font-display text-[18px] tracking-[2px] text-bg shadow-[0_0_20px_rgba(0,255,225,0.2)] transition active:scale-[0.99]"
        >
          CREATE ACCOUNT →
        </button>

        <p className="mt-2 text-center text-[10px] leading-[1.6] text-muted">
          Your card is saved securely via Stripe. You are only charged when you
          buy credits.
        </p>
      </form>

      {toastNode}
    </>
  );
}