"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { Field, Input } from "@/components/ui/input";
import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * ResetPasswordForm — landing page for Supabase password-recovery links.
 *
 * The email link points to /reset-password with recovery tokens. The form:
 *  1. Swaps the tokens for a session (works for both the implicit hash flow
 *     and PKCE `code` flow).
 *  2. Lets the user pick a new password via updateUser({ password }).
 *  3. Signs out and sends them back to the login page.
 */
export default function ResetPasswordForm() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [recovered, setRecovered] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseClient();

    // The SDK fires PASSWORD_RECOVERY when initialized with a recovery link.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === "PASSWORD_RECOVERY" && session && !cancelled) {
        setRecovered(true);
      }
    });

    (async () => {
      try {
        // Fallback: manually exchange whatever tokens the link carries.
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const code = new URLSearchParams(window.location.search).get("code");

        if (code) {
          const { data } = await supabase.auth.exchangeCodeForSession(code);
          if (!cancelled && data.session) setRecovered(true);
        } else if (accessToken && refreshToken) {
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!cancelled) {
            if (data.session) setRecovered(true);
            else if (sessionError) {
              setLinkError(
                "This reset link is invalid or has expired. Request a new one below."
              );
            }
          }
        } else {
          if (!cancelled) {
            setLinkError(
              "This reset link is invalid or has expired. Request a new one below."
            );
          }
        }
      } catch {
        if (!cancelled) {
          setLinkError(
            "This reset link is invalid or has expired. Request a new one below."
          );
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const canSubmit =
    password.length >= 6 && confirm.length > 0 && !submitting;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(
          updateError.message ?? "Could not update your password. Please try again."
        );
        setSubmitting(false);
        return;
      }
      await supabase.auth.signOut();
      router.push("/login?reset=success");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <>
      {checking ? (
        <p className="py-6 text-center text-[13px] text-muted">
          Checking your link…
        </p>
      ) : !recovered ? (
        <div className="rounded-lg border border-edge bg-surface-2 px-4 py-4 text-center">
          <p className="text-[13px] leading-[1.7] text-muted">{linkError}</p>
          <p className="mt-2 text-center text-[13px] text-muted">
            Go back to the{" "}
            <a href="/login" className="font-semibold text-neon underline">
              log in page
            </a>{" "}
            and use &quot;Forgot password&quot; to get a fresh link.
          </p>
        </div>
      ) : (
        <form className="mb-3.5 flex flex-col gap-3.5" onSubmit={handleSubmit} noValidate>
          <Field label="New Password">
            <div className="relative w-full">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Choose a new password"
                autoComplete="new-password"
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

          <Field label="Confirm Password">
            <Input
              type="password"
              placeholder="Repeat your new password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>

          {error && <p className="text-center text-xs text-neon-2">{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-1 w-full cursor-pointer rounded-[10px] bg-gradient-to-br from-neon to-[#00c9b1] px-4 py-[15px] font-display text-[18px] tracking-[2px] text-bg shadow-[0_0_20px_rgba(0,255,225,0.2)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "UPDATING…" : "RESET PASSWORD →"}
          </button>
        </form>
      )}
    </>
  );
}