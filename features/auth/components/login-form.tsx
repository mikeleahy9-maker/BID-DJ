"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "./use-toast";
import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Guest login form — faithful port of screen-login from the prototype.
 * Authenticates against Supabase with signInWithPassword.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function friendlyAuthError(message: string): string {
  const msg = message.toLowerCase();
  if (msg.includes("invalid login credentials")) {
    return "Incorrect email or password.";
  }
  if (msg.includes("email not confirmed")) {
    return "Email not confirmed yet — check your inbox for the verification link.";
  }
  if (msg.includes("rate limit") || msg.includes("too many requests")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  return "Could not sign in. Please try again.";
}

function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return EMAIL_RE.test(trimmed) ? null : "Please enter a valid email address (e.g. you@email.com).";
}

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailNotFound, setEmailNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { show, toastNode } = useToast();

  const checkEmailExists = async (value: string): Promise<boolean | undefined> => {
    const trimmed = value.trim();
    if (!EMAIL_RE.test(trimmed)) return undefined;
    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      const exists = Boolean(res.ok && json.exists);
      if (exists) {
        setEmailNotFound(false);
        setEmailError(null);
      } else {
        setEmailNotFound(true);
        setEmailError("No account found with this email — create one instead.");
      }
      return exists;
    } catch {
      // Best-effort check; the provider still rejects at submit time.
      return undefined;
    }
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setEmailError(null);
    setEmailNotFound(false);
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

  const canSubmit =
    Boolean(email.trim() && password.trim()) &&
    EMAIL_RE.test(email.trim()) &&
    !emailNotFound;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    const formatError = validateEmail(email);
    if (formatError) {
      setEmailError(formatError);
      setError(null);
      return;
    }
    let exists = true;
    if (emailNotFound) {
      exists = false;
    } else {
      exists = (await checkEmailExists(email)) ?? true;
    }
    if (!exists) {
      setError("No account found with this email — create one instead.");
      return;
    }
    setError(null);
    setSubmitting(true);

    const supabase = getSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setSubmitting(false);
      setError(friendlyAuthError(signInError.message));
      return;
    }

    show("✓ Logged in! Redirecting…");
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <>
      <form className="mb-5 flex flex-col gap-3.5" onSubmit={handleSubmit} noValidate>
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
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
        </Field>

        {error && <p className="text-center text-xs text-neon-2">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="mt-1 w-full cursor-pointer rounded-[10px] bg-gradient-to-br from-neon to-[#00c9b1] px-4 py-[15px] font-display text-[18px] tracking-[2px] text-bg shadow-[0_0_20px_rgba(0,255,225,0.2)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <span className="inline-flex items-center justify-center gap-2">
              <svg
                className="animate-spin"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              LOGGING IN…
            </span>
          ) : (
            <>LOG IN →</>
          )}
        </button>
      </form>

      {toastNode}
    </>
  );
}

