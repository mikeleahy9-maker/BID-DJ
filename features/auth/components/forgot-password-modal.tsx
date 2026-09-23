"use client";

import { FormEvent, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Field, Input } from "@/components/ui/input";
import { getSupabaseClient } from "@/lib/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function friendlyAuthError(message: string): string {
  const msg = message.toLowerCase();
  if (msg.includes("rate limit") || msg.includes("too many requests")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  return "Could not send the reset link. Please try again.";
}

interface ForgotPasswordModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * ForgotPasswordModal — popup that asks for the account email, then sends the
 * Supabase password-recovery email pointing at /reset-password.
 */
export default function ForgotPasswordModal({
  open,
  onClose,
}: ForgotPasswordModalProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = EMAIL_RE.test(email.trim()) && !submitting;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      const { error: sendError } = await supabase.auth.resetPasswordForEmail(
        trimmed,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );
      if (sendError) {
        setError(friendlyAuthError(sendError.message));
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
      setSent(true);
    } catch {
      setError("Could not send the reset link. Please try again.");
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setEmail("");
    setError(null);
    setSent(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} sheet>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-[22px] tracking-[1px] text-foreground">
          Forgot password?
        </h2>
        <button
          onClick={handleClose}
          aria-label="Close"
          className="cursor-pointer rounded p-1 text-[18px] leading-none text-muted transition hover:text-foreground"
        >
          ✕
        </button>
      </div>

      {sent ? (
        <div className="py-2 text-center">
          <div className="mb-3 text-[32px]" aria-hidden>
            📬
          </div>
          <p className="text-[13px] leading-[1.7] text-muted">
            If an account exists for{" "}
            <span className="text-foreground">{email.trim()}</span>, a reset
            link is on its way. Check your inbox (and spam).
          </p>
          <button
            onClick={handleClose}
            className="mt-4 w-full cursor-pointer rounded-[10px] bg-gradient-to-br from-neon to-[#00c9b1] px-4 py-[13px] font-display text-[16px] tracking-[2px] text-bg shadow-[0_0_20px_rgba(0,255,225,0.2)] transition active:scale-[0.99]"
          >
            CLOSE →
          </button>
        </div>
      ) : (
        <form className="flex flex-col gap-3.5" onSubmit={handleSubmit} noValidate>
          <p className="text-[13px] leading-[1.7] text-muted">
            Enter the email you signed up with and we&apos;ll send you a reset
            link.
          </p>

          <Field label="Email">
            <Input
              type="email"
              placeholder="you@email.com"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
            />
          </Field>

          {error && <p className="text-center text-xs text-neon-2">{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-1 w-full cursor-pointer rounded-[10px] bg-gradient-to-br from-neon to-[#00c9b1] px-4 py-[15px] font-display text-[18px] tracking-[2px] text-bg shadow-[0_0_20px_rgba(0,255,225,0.2)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "SENDING…" : "SEND RESET LINK →"}
          </button>
        </form>
      )}
    </Modal>
  );
}