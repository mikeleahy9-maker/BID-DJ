import Link from "next/link";

/**
 * "No downloads. Just join." section — shows how guests join a private event.
 * Uses supported product facts (code/QR, browser-based, credits).
 */
export function JoinVisual() {
  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

  return (
    <section className="border-t border-edge/60">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[3px] text-neon">
              No downloads. Just join.
            </p>
            <h2 className="mt-3 font-display text-[36px] leading-[1.05] tracking-[2px] text-foreground sm:text-[44px]">
              Scan or enter the event code
            </h2>
            <p className="mt-4 max-w-xl text-base leading-[1.7] text-muted">
              Every event is private. Guests scan the QR or enter the event code
              in their browser, buy credits, and start requesting songs in seconds.
              No app required.
            </p>

            <ul className="mt-6 space-y-3 text-sm text-foreground">
              <li className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-neon/15 text-[11px] font-bold text-neon"
                >
                  ✓
                </span>
                <span>Private access via event code or QR</span>
              </li>
              <li className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-neon/15 text-[11px] font-bold text-neon"
                >
                  ✓
                </span>
                <span>Browser-based — works on any phone</span>
              </li>
              <li className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-neon/15 text-[11px] font-bold text-neon"
                >
                  ✓
                </span>
                <span>Buy credits and bid to shape the queue</span>
              </li>
            </ul>

            {/* <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className={`rounded text-sm font-semibold text-neon hover:underline ${focusRing}`}
              >
                Already have an account? Log In →
              </Link>
            </div> */}
          </div>

          <div className="relative mx-auto w-full max-w-sm lg:max-w-md">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-6 rounded-[40px] bg-[radial-gradient(ellipse_at_center,rgba(0,255,225,0.12),transparent_70%)] blur-2xl"
            />
            <div className="relative rounded-3xl border border-edge bg-surface p-6 shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
              <div className="rounded-2xl border border-edge bg-surface-2 p-6 text-center">
                <p className="text-[11px] uppercase tracking-[2px] text-muted">
                  Event QR
                </p>
                <div className="mt-4 mx-auto flex size-48 items-center justify-center rounded-2xl bg-white shadow-inner">
                  <div className="grid size-40 grid-cols-8 gap-1 p-2">
                    {Array.from({ length: 64 }).map((_, i) => (
                      <span
                        key={i}
                        className={`${
                          i % 3 === 0 || (i % 7 === 0 && i > 8)
                            ? "bg-black"
                            : "bg-white"
                        } rounded-sm`}
                      />
                    ))}
                  </div>
                </div>
                <p className="mt-4 font-display text-[28px] tracking-[2px] text-foreground">
                  LOFT22
                </p>
                <p className="mt-1 text-xs text-muted">
                  Scan to join · Browser only · Private
                </p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] text-muted">
                <span className="rounded-lg border border-edge bg-surface-2 px-2 py-2">
                  Scan QR
                </span>
                <span className="rounded-lg border border-edge bg-surface-2 px-2 py-2">
                  Enter code
                </span>
                <span className="rounded-lg border border-edge bg-surface-2 px-2 py-2">
                  Buy credits
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default JoinVisual;
