import Link from "next/link";

/**
 * Bottom CTA band to drive conversion.
 */
export function CtaBand() {
  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

  return (
    <section className="border-t border-edge/60">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="relative overflow-hidden rounded-3xl border border-edge/60 bg-[radial-gradient(ellipse_at_50%_0%,rgba(0,255,225,0.12),transparent_60%)] px-6 py-10 text-center shadow-[0_24px_70px_rgba(0,0,0,0.5)] sm:px-10 sm:py-14">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(168,85,247,0.08),transparent_55%)]"
          />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[3px] text-neon">
              Ready to own the night?
            </p>
            <h2 className="mt-3 font-display text-[36px] leading-[1.05] tracking-[2px] text-foreground sm:text-[44px] lg:text-[52px]">
              Shape the soundtrack. Start in seconds.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-[1.7] text-muted">
              Get Started as a guest or head to the DJ/Band Portal to run your
              next event. No app download required.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className={`inline-flex items-center justify-center gap-2 rounded-xl bg-neon px-6 py-3.5 text-base font-semibold text-bg shadow-[0_0_24px_rgba(0,255,225,0.25)] transition hover:opacity-90 active:scale-[0.98] ${focusRing}`}
              >
                Get Started
              </Link>
              <Link
                href="/dj-login"
                className={`inline-flex items-center justify-center gap-2 rounded-xl border border-neon/40 bg-neon/5 px-6 py-3.5 text-base font-semibold text-neon transition hover:border-neon hover:bg-neon/10 active:scale-[0.98] ${focusRing}`}
              >
                DJ / Band Portal
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default CtaBand;
