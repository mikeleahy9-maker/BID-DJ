"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Field, FieldRow, Input } from "@/components/ui/input";
import { useToast } from "./use-toast";
import { getSupabaseClient } from "@/lib/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return EMAIL_RE.test(trimmed) ? null : "Please enter a valid email address (e.g. you@email.com).";
}

/**
 * DJ / Band signup with the $50 activation flow.
 *
 * 1. Creates the Supabase auth user (profile row with role='dj' is created
 *    by the `on_auth_user_created` DB trigger).
 * 2. Redirects to Stripe-hosted Checkout to collect the one-time $50 fee.
 * 3. The Stripe webhook marks the account activated once payment succeeds.
 *
 * Email confirmation is enabled, so the DJ verifies their email before the
 * first sign-in; the fee can be paid right after registration either way.
 */

export default function DJSignupForm() {
  const { toastNode } = useToast();
  const searchParams = useSearchParams();
  const canceled = searchParams.get("payment") === "canceled";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [actName, setActName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [city, setCity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
        setEmailError("This email is already registered. Please use a different one.");
      } else {
        setEmailTaken(false);
        setEmailError(null);
      }
    } catch {
      // Best-effort check; signUp still rejects duplicates at submit time.
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim() || !actName.trim() || !email.trim()) {
      setError("Please fill in the required account fields.");
      return;
    }
    const formatError = validateEmail(email);
    if (formatError) {
      setEmailError(formatError);
      setError(null);
      return;
    }
    if (emailTaken) {
      setError("This email is already registered. Please use a different one.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            role: "dj",
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            act_name: actName.trim(),
            city: city.trim(),
          },
        },
      });

      if (signUpError) throw signUpError;
      const userId = data.user?.id;
      if (!userId) throw new Error("Signup did not return a user.");

      // Redirect to Stripe Checkout for the $50 activation fee.
      const checkout = await fetch("/api/checkout/dj-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const checkoutJson = await checkout.json().catch(() => ({}));
      if (!checkout.ok || !checkoutJson.url) {
        throw new Error(checkoutJson.error ?? "Could not start payment.");
      }
      window.location.href = checkoutJson.url;
    } catch (err) {
      const message =
        err instanceof Error && /already registered|already been registered/i.test(err.message)
          ? "This email is already registered. Please use a different one."
          : err instanceof Error
            ? err.message
            : "Signup failed. Please try again.";
      setError(message);
      setSubmitting(false);
    }
  };

  const canSubmit =
    !submitting &&
    Boolean(firstName.trim() && lastName.trim() && actName.trim() && email.trim() && password.trim()) &&
    EMAIL_RE.test(email.trim());

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
            onChange={(e) => handleEmailChange(e.target.value)}
            onBlur={handleEmailBlur}
          />
          {emailError && <p className="text-xs text-neon-2">{emailError}</p>}
        </Field>

        <Field label="Password">
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Choose a strong password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pr-10"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-muted transition hover:text-neon-3"
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
        </Field>

        <Field label="City / Market">
          <Input
            placeholder="e.g. Chicago, IL"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </Field>

        <div className="my-2 h-px bg-edge" />

        <div className="flex items-start gap-3 rounded-lg bg-surface-2 p-3.5">
          <span className="text-xl" aria-hidden>💳</span>
          <div>
            <div className="text-[13px] font-semibold">Pay your $50 activation on the next screen</div>
            <div className="mt-0.5 text-[11px] leading-[1.6] text-muted">
              After signup you&apos;ll be taken to Stripe&apos;s secure checkout to pay the
              one-time fee. Your account activates instantly once payment clears.
            </div>
          </div>
        </div>

        {canceled && (
          <div className="rounded-lg border border-neon-2/30 bg-neon-2/10 p-3.5 text-center">
            <p className="text-xs font-semibold text-neon-2">
              Payment canceled — no charge was made.
            </p>
            <p className="mt-1.5 text-[11px] leading-[1.7] text-muted">
              Your DJ account is already created. Confirm your email, then log in
              and pay the $50 activation fee from your dashboard to unlock it.
            </p>
          </div>
        )}

        {error && <p className="text-center text-xs text-neon-2">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-1 w-full cursor-pointer rounded-[10px] bg-gradient-to-br from-neon-3 to-[#ff8800] px-4 py-[15px] font-display text-[18px] tracking-[2px] text-bg shadow-[0_0_20px_rgba(255,230,0,0.2)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "ACTIVATING…" : "ACTIVATE ACCOUNT — $50 →"}
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