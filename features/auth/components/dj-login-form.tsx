"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "./use-toast";
import { getSupabaseClient } from "@/lib/supabase/client";

type DJRole = "owner" | "helper";

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

export default function DJLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { show, toastNode } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<DJRole>("owner");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const activated = searchParams.get("activated") === "1";

  useEffect(() => {
    if (activated) show("Account activated — welcome aboard!");
  }, [activated, show]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    setError(null);

    setSubmitting(true);
    const supabase = getSupabaseClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(friendlyAuthError(signInError.message));
      setSubmitting(false);
      return;
    }

    // DJ login is for DJ/helper accounts only — guests belong on the guest page.
    const { data: profile } = data.user
      ? await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .maybeSingle()
      : { data: null };
    const role = (profile as { role?: string } | null)?.role;

    if (role !== "dj" && role !== "helper") {
      await supabase.auth.signOut();
      setSubmitting(false);
      setError(
        role === "guest"
          ? "DJ account not found."
          : "This account doesn't have DJ access."
      );
      return;
    }

    router.push("/dj/events");
    router.refresh();
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      show("Enter your email above, then click Forgot password.");
      return;
    }
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) {
      setError(friendlyAuthError(error.message));
    } else {
      show("Password reset link sent to your email.");
    }
  };

  const roleOpt = (value: DJRole, icon: string, title: string, sub: string) => (
    <button
      type="button"
      onClick={() => setRole(value)}
      className={`flex flex-1 cursor-pointer items-center gap-2.5 rounded-[10px] border p-3 text-left transition active:scale-[0.97] ${
        role === value
          ? "border-neon-3 bg-neon-3/5"
          : "border-edge bg-surface-2 text-foreground"
      }`}
    >
      <span className="shrink-0 text-[20px]" aria-hidden>
        {icon}
      </span>
      <span>
        <span className="block text-[13px] font-bold">{title}</span>
        <span className="mt-0.5 block text-[10px] text-muted">{sub}</span>
      </span>
    </button>
  );

  return (
    <>
      {activated && (
        <p className="mb-4 rounded-lg border border-neon-3/25 bg-neon-3/10 p-3 text-center text-xs text-foreground">
          🎉 <span className="font-bold">Account activated!</span> Log in to get
          started with your first gig.
        </p>
      )}

      <form className="mb-5 flex flex-col gap-3.5" onSubmit={handleSubmit} noValidate>
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

        <Field label="Login as">
          <div className="flex gap-2">
            {roleOpt("owner", "🎛️", "Owner", "Full access — gigs, earnings, settings")}
            {roleOpt("helper", "🤝", "Helper", "Queue only — no financials")}
          </div>
        </Field>

        {error && <p className="text-center text-xs text-neon-2">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-1 w-full cursor-pointer rounded-[10px] bg-gradient-to-br from-neon-3 to-[#ff8800] px-4 py-[15px] font-display text-[18px] tracking-[2px] text-bg shadow-[0_0_20px_rgba(255,230,0,0.2)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "LOGGING IN…" : "LOG IN TO DASHBOARD →"}
        </button>

        <button
          type="button"
          className="cursor-pointer border-none bg-transparent text-center text-xs text-muted underline hover:text-neon-3"
          onClick={handleForgotPassword}
        >
          Forgot password?
        </button>
      </form>

      {toastNode}
    </>
  );
}