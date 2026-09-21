"use client";

import { FormEvent, useState } from "react";
import { Field, FieldRow, Input } from "@/components/ui/input";
import { useToast } from "./use-toast";

/**
 * Guest account signup form — faithful port of screen-create.
 * Card fields are captured for fidelity; Stripe Elements will replace them later.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return EMAIL_RE.test(trimmed) ? null : "Please enter a valid email address (e.g. you@email.com).";
}

export default function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [card, setCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const { show, toastNode } = useToast();

  const checkEmailExists = async (value: string) => {
    const trimmed = value.trim();
    if (!EMAIL_RE.test(trimmed)) return;
    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.exists) {
        setEmailTaken(true);
        setEmailError("This email is already registered — use the log in page instead.");
      } else {
        setEmailTaken(false);
        setEmailError(null);
      }
    } catch {
      // Best-effort check; final duplicates are still rejected at submit time.
    }
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setEmailError(null);
    setEmailTaken(false);
  };

  const handleEmailBlur = () => {
    const formatError = validateEmail(email);
    if (formatError) {
      setEmailError(formatError);
      return;
    }
    if (!email.trim()) {
      setEmailError(null);
      return;
    }
    checkEmailExists(email);
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (value && value.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
    } else {
      setPasswordError(null);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in your name, email, and password.");
      return;
    }
    const formatError = validateEmail(email);
    if (formatError) {
      setEmailError(formatError);
      setError(null);
      return;
    }
    if (emailTaken) {
      setError("This email is already registered — use the log in page instead.");
      return;
    }
    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      setError(null);
      return;
    }
    setError(null);
    show("✓ Account created! (Supabase auth — coming soon)");
  };

  const canSubmit =
    Boolean(name.trim() && email.trim() && password.trim()) &&
    EMAIL_RE.test(email.trim()) &&
    password.length >= 6;

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
            onChange={(e) => handleEmailChange(e.target.value)}
            onBlur={handleEmailBlur}
          />
          {emailError && <p className="text-xs text-neon-2">{emailError}</p>}
        </Field>

        <Field label="Password">
          <div className="relative w-full">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Choose a password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              className="w-full pr-10"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-muted transition hover:text-neon"
            >
              {showPassword ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          {passwordError && <p className="text-xs text-neon-2">{passwordError}</p>}
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
          disabled={!canSubmit}
          className="mt-1 w-full cursor-pointer rounded-[10px] bg-gradient-to-br from-neon to-[#00c9b1] px-4 py-[15px] font-display text-[18px] tracking-[2px] text-bg shadow-[0_0_20px_rgba(0,255,225,0.2)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
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