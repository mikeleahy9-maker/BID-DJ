"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import type {
  Appearance,
  Stripe,
  StripeElements,
  StripePaymentElement,
} from "@stripe/stripe-js";
import { Field, FieldRow, Input } from "@/components/ui/input";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

const STRIPE_APPEARANCE: Appearance = {
  theme: "night",
  variables: {
    colorPrimary: "#00ffe1",
    colorBackground: "#111111",
    colorText: "#f0f0f0",
    colorTextSecondary: "#666666",
    colorDanger: "#ff2d78",
    borderRadius: "8px",
    spacingUnit: "4px",
    inputColorBorder: "#2a2a2a",
    inputFocusColorBorder: "#00ffe1",
    focusBoxShadow: "0 0 0 1px #00ffe1",
  },
};

function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return EMAIL_RE.test(trimmed)
    ? null
    : "Please enter a valid email address (e.g. you@email.com).";
}

export default function SignupForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"account" | "card">("account");
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("setup") === "complete") {
      window.location.replace("/login?signup=success");
    }
  }, []);

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
        setEmailError(
          "This email is already registered — use the log in page instead."
        );
      } else {
        setEmailTaken(false);
        setEmailError(null);
      }
    } catch {
      return;
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

  const handleAccountSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in your first name, last name, email, and password.");
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
    setSubmitting(true);
    try {
      const res = await fetch("/api/signup-guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          password,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Could not create your account. Please try again.");
        return;
      }
      setClientSecret(json.client_secret);
      setStep("card");
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    Boolean(firstName.trim() && lastName.trim() && email.trim() && password.trim()) &&
    EMAIL_RE.test(email.trim()) &&
    password.length >= 6 &&
    !emailTaken;

  return (
    <>
      {step === "account" ? (
        <form
          className="mb-3.5 flex flex-col gap-3.5"
          onSubmit={handleAccountSubmit}
          noValidate
        >
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

          {error && <p className="text-center text-xs text-neon-2">{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="mt-1 w-full cursor-pointer rounded-[10px] bg-gradient-to-br from-neon to-[#00c9b1] px-4 py-[15px] font-display text-[18px] tracking-[2px] text-bg shadow-[0_0_20px_rgba(0,255,225,0.2)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "CREATING…" : "CREATE ACCOUNT →"}
          </button>
        </form>
      ) : clientSecret ? (
        <CardStep clientSecret={clientSecret} />
      ) : null}
    </>
  );
}

function CardStep({ clientSecret }: { clientSecret: string }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const paymentElementRef = useRef<StripePaymentElement | null>(null);
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      setReady(false);
      try {
        if (!STRIPE_PK) {
          setCardError("Stripe isn't configured. Please try again later.");
          return;
        }
        const stripe = await loadStripe(STRIPE_PK);
        if (!stripe || cancelled) return;
        const elements = stripe.elements({
          clientSecret,
          appearance: STRIPE_APPEARANCE,
        });
        const paymentElement = elements.create("payment");
        stripeRef.current = stripe;
        elementsRef.current = elements;
        paymentElementRef.current = paymentElement;
        if (containerRef.current) {
          paymentElement.mount(containerRef.current);
        }
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) {
          setCardError("Couldn't load the payment form. Please try again.");
        }
      }
    }

    setup();

    return () => {
      cancelled = true;
      if (paymentElementRef.current) {
        paymentElementRef.current.destroy();
        paymentElementRef.current = null;
      }
      elementsRef.current = null;
      stripeRef.current = null;
    };
  }, [clientSecret, attempt]);

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault();
    const stripe = stripeRef.current;
    const elements = elementsRef.current;
    if (!stripe || !elements) return;
    setProcessing(true);
    setCardError(null);
    try {
      const result = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
        confirmParams: {
          return_url: `${window.location.origin}/signup?setup=complete`,
        },
      });
      if (result.error) {
        setCardError(
          result.error.message ?? "We couldn't save your card. Please try again."
        );
        setAttempt((a) => a + 1);
      } else {
        router.push("/login?signup=success");
      }
    } catch {
      setCardError("Something went wrong. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form className="mb-3.5 flex flex-col gap-3.5" onSubmit={handleConfirm} noValidate>
      <div className="my-1 flex items-center gap-3">
        <span className="h-px flex-1 bg-edge" />
        <span className="text-[11px] uppercase tracking-[1px] text-muted">
          Your card
        </span>
        <span className="h-px flex-1 bg-edge" />
      </div>

      <div
        ref={containerRef}
        className="rounded-lg border border-edge bg-surface-2 px-[14px] py-[11px]"
      />

      {cardError && <p className="text-center text-xs text-neon-2">{cardError}</p>}

      <button
        type="submit"
        disabled={!ready || processing}
        className="mt-1 w-full cursor-pointer rounded-[10px] bg-gradient-to-br from-neon to-[#00c9b1] px-4 py-[15px] font-display text-[18px] tracking-[2px] text-bg shadow-[0_0_20px_rgba(0,255,225,0.2)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {processing ? "SAVING…" : "SAVE CARD →"}
      </button>

      <p className="mt-2 text-center text-[10px] leading-[1.6] text-muted">
        Your card is saved securely via Stripe. You are only charged when you buy
        credits.
      </p>
    </form>
  );
}