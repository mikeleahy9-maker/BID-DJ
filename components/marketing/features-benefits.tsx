/**
 * Features & Benefits section — highlights core capabilities.
 * Uses supported product facts (private events, bidding, queue, payouts).
 */

const features = [
  {
    title: "Private Events",
    body: "Each event has its own code/QR. Only invited guests can join and participate.",
    accent: "neon",
  },
  {
    title: "Crowd-Driven Queue",
    body: "Guests bid to move songs up the live queue — the crowd helps shape what plays next.",
    accent: "neon-2",
  },
  {
    title: "No App Needed",
    body: "Works instantly in any mobile browser. No downloads, no friction for guests.",
    accent: "neon-3",
  },
  {
    title: "Real-Time Control",
    body: "DJs and bands run the queue in real time — approve, reorder, skip or play with ease.",
    accent: "neon",
  },
  {
    title: "Stripe-Secure",
    body: "Credits, tips, and payouts are handled securely via Stripe.",
    accent: "neon-2",
  },
  {
    title: "Automatic Donations",
    body: "Unused credits at event close are donated to the organizer — not refunded to guests.",
    accent: "neon-3",
  },
] as const;

const accentMap = {
  neon: {
    glow: "bg-neon/20",
    border: "border-neon/40",
    bg: "bg-neon/[0.04]",
    text: "text-neon",
  },
  "neon-2": {
    glow: "bg-neon-2/20",
    border: "border-neon-2/40",
    bg: "bg-neon-2/[0.04]",
    text: "text-neon-2",
  },
  "neon-3": {
    glow: "bg-neon-3/20",
    border: "border-neon-3/40",
    bg: "bg-neon-3/[0.04]",
    text: "text-neon-3",
  },
} as const;

/**
 * Features & Benefits section.
 */
export function FeaturesBenefits() {
  return (
    <section className="border-t border-edge/60">
      <div className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(0,255,225,0.08),transparent_55%)]"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[3px] text-neon">
              Features &amp; Benefits
            </p>
            <h2 className="mt-3 font-display text-[36px] leading-[1.05] tracking-[2px] text-foreground sm:text-[44px]">
              Main product capabilities
            </h2>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const a = accentMap[feature.accent];
              return (
                <div
                  key={feature.title}
                  className={`group relative rounded-2xl border ${a.border} ${a.bg} p-8 shadow-[0_20px_60px_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5 hover:border-neon/60`}
                >
                  <div
                    aria-hidden
                    className={`pointer-events-none absolute -top-4 left-8 size-16 rounded-full ${a.glow} blur-2xl transition group-hover:opacity-100`}
                  />
                  <h3 className="relative font-display text-[20px] tracking-[1px] text-foreground md:text-[22px]">
                    {feature.title}
                  </h3>
                  <p className="relative mt-3 text-sm leading-[1.8] text-muted">
                    {feature.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default FeaturesBenefits;
