/**
 * Landing page — auth first.
 * Faithful port of screen-landing from the prototype: hero logo, the
 * three auth entry cards, the DJ login strip, and the demo hint.
 * All styling via Tailwind utilities + theme tokens.
 */

import Link from "next/link";
import { Logo } from "@/components/shared/logo";

export const metadata = {
  title: "BidaBeat — Bid the Beat",
  description:
    "Bid the Beat. Own the Night. A crowd-funded jukebox for live events — request songs and bid to move them up the queue.",
};

const authBtnBase =
  "flex w-full cursor-pointer items-center gap-3.5 rounded-xl border p-4 text-left text-foreground transition active:scale-[0.98]";

export default function HomePage() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(0,255,225,0.09),transparent_60%),radial-gradient(ellipse_at_80%_80%,rgba(255,45,120,0.07),transparent_50%)]"
      />

      <div className="relative z-[1] flex w-full flex-col items-center gap-[18px] px-6 pb-9 pt-10">
        <div className="text-center">
          <Logo layout="stack" />
          <p className="mt-2.5 text-center text-[11px] uppercase tracking-[3px] text-muted">
            Bid the Beat. Own the Night.
          </p>
          <p className="text-center text-[10px] italic uppercase tracking-[4px] text-white/20">
            Buy da Beat
          </p>
        </div>

        <div className="flex w-full max-w-[360px] flex-col gap-2.5">
          <Link
            href="/login"
            className={`${authBtnBase} border-neon/30 bg-neon/5 active:border-neon`}
          >
            <span className="shrink-0 text-2xl" aria-hidden>
              👤
            </span>
            <span>
              <span className="block text-[15px] font-bold">Log In</span>
              <span className="mt-0.5 block text-[11px] text-muted">
                Access your existing account
              </span>
            </span>
            <span className="ml-auto text-[18px] text-muted" aria-hidden>
              →
            </span>
          </Link>

          <div className="flex items-center gap-2.5 py-0.5 text-[11px] text-muted">
            <span className="h-px flex-1 bg-edge" />
            <span>New to BidaBeat?</span>
            <span className="h-px flex-1 bg-edge" />
          </div>

          <Link
            href="/signup"
            className={`${authBtnBase} border-accent/30 bg-accent/5`}
          >
            <span className="shrink-0 text-2xl" aria-hidden>
              ✨
            </span>
            <span>
              <span className="block text-[15px] font-bold">Create Account</span>
              <span className="mt-0.5 block text-[11px] text-muted">
                Save credits, history &amp; payment info once
              </span>
            </span>
            <span className="ml-auto text-[18px] text-muted" aria-hidden>
              →
            </span>
          </Link>

          <Link
            href="/guest"
            className={`${authBtnBase} border-neon-2/30 bg-neon-2/5`}
          >
            <span className="shrink-0 text-2xl" aria-hidden>
              🎟️
            </span>
            <span>
              <span className="block text-[15px] font-bold">Join as Guest</span>
              <span className="mt-0.5 block text-[11px] text-muted">
                Quick entry — card saved for tonight
              </span>
            </span>
            <span className="ml-auto text-[18px] text-muted" aria-hidden>
              →
            </span>
          </Link>
        </div>

        <Link
          href="/dj-login"
          className="flex w-full max-w-[360px] items-center justify-between gap-3 rounded-xl border border-neon-3/25 bg-surface px-4 py-3.5 text-foreground transition active:scale-[0.98] active:border-neon-3"
        >
          <span className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden>
              🎛️
            </span>
            <span>
              <span className="block text-[14px] font-bold text-neon-3">
                DJ / Band Login
              </span>
              <span className="mt-0.5 block text-[11px] text-muted">
                Manage gigs, queue &amp; earnings
              </span>
            </span>
          </span>
          <span className="text-[18px] text-neon-3" aria-hidden>
            →
          </span>
        </Link>

        <p className="max-w-[320px] rounded-lg border border-edge bg-surface px-3.5 py-2.5 text-center text-[11px] leading-[1.7] text-muted">
          <strong className="text-neon">Demo:</strong> any guest login works ·
          event code <strong className="text-neon">LOFT22</strong>
          <br />
          DJ email <strong className="text-neon-3">dj@demo.com</strong> / pass{" "}
          <strong className="text-neon-3">any</strong>
        </p>
      </div>
    </section>
  );
}