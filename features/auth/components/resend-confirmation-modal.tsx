"use client";

import { FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Field, Input } from "@/components/ui/input";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface ResendConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  email: string;
  onEmailChange: (value: string) => void;
  /** True once a confirmation email has been sent for `email`. */
  sent: boolean;
  sending: boolean;
  error: string | null;
  onSend: () => void;
}

/**
 * ResendConfirmationModal — popup for re-sending the DJ signup confirmation
 * email when the original link expired or never arrived.
 *
 * Presentational: the owning form holds the send state so the same modal can
 * be opened either already-sent (after an "email not confirmed" login) or fresh
 * (from the login screen's "resend it" link).
 */
export default function ResendConfirmationModal({
  open,
  onClose,
  email,
  onEmailChange,
  sent,
  sending,
  error,
  onSend,
}: ResendConfirmationModalProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSend();
  };

  const handleClose = () => {
    if (sending) return;
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} sheet>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-[22px] tracking-[1px] text-foreground">
          Confirm your email
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
            We sent a confirmation link to{" "}
            <span className="text-foreground">{email.trim()}</span>. Please check
            your inbox (and spam) and click the link to activate your account.
          </p>
          <p className="mt-3 text-[12px] leading-[1.7] text-muted">
            Link expired or email not received?
          </p>
          <button
            type="button"
            onClick={onSend}
            disabled={sending}
            className="mt-2 w-full cursor-pointer rounded-[10px] border border-neon-3/40 bg-neon-3/10 px-4 py-[13px] font-display text-[15px] tracking-[2px] text-neon-3 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? "RESENDING…" : "RESEND CONFIRMATION EMAIL →"}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="mt-2 w-full cursor-pointer rounded-[10px] bg-gradient-to-br from-neon to-[#00c9b1] px-4 py-[13px] font-display text-[16px] tracking-[2px] text-bg shadow-[0_0_20px_rgba(0,255,225,0.2)] transition active:scale-[0.99]"
          >
            CLOSE →
          </button>
        </div>
      ) : (
        <form className="flex flex-col gap-3.5" onSubmit={handleSubmit} noValidate>
          <p className="text-[13px] leading-[1.7] text-muted">
            Your email isn&apos;t confirmed yet. We&apos;ll send a fresh
            confirmation link so you can activate your DJ account. If the
            original link expired or never arrived, resend it below.
          </p>

          <Field label="Email">
            <Input
              type="email"
              placeholder="you@email.com"
              autoComplete="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
            />
          </Field>

          {error && <p className="text-center text-xs text-neon-2">{error}</p>}

          <button
            type="submit"
            disabled={sending || !EMAIL_RE.test(email.trim())}
            className="mt-1 w-full cursor-pointer rounded-[10px] bg-gradient-to-br from-neon to-[#00c9b1] px-4 py-[15px] font-display text-[18px] tracking-[2px] text-bg shadow-[0_0_20px_rgba(0,255,225,0.2)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? "SENDING…" : "RESEND CONFIRMATION EMAIL →"}
          </button>
        </form>
      )}
    </Modal>
  );
}
