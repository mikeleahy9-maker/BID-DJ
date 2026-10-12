"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Field, FieldRow, Input } from "@/components/ui/input";
import { CardSetupForm } from "@/features/payments/card-setup-form";
import { getSupabaseClient } from "@/lib/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return EMAIL_RE.test(trimmed)
    ? null
    : "Please enter a valid email address (e.g. you@email.com).";
}

export default function SignupForm() {
  const router = useRouter();
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
        <CardSetupForm
          clientSecret={clientSecret}
          returnUrl={`${window.location.origin}/signup?setup=complete`}
          onSaved={async ({ setupIntentId }) => {
            // Guest accounts are auto-confirmed at signup (email_confirm: true),
            // so we can sign them in immediately — no manual login.
            const supabase = getSupabaseClient();
            const { error: signInError } = await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            });
            if (signInError) {
              throw new Error(
                "Your account was created, but automatic sign-in failed. Please log in at the login page."
              );
            }

            // Persist the card synchronously so the guest dashboard gate
            // passes right away (no waiting on the Stripe webhook).
            const res = await fetch("/api/guest/confirm-card", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ setupIntentId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              throw new Error(
                (data as { error?: string }).error ??
                  "Could not save your card. Please try again."
              );
            }

            router.push("/dashboard");
            router.refresh();
          }}
          footer="Your card is saved securely via Stripe. You are only charged when you buy credits."
        />
      ) : null}
    </>
  );
}