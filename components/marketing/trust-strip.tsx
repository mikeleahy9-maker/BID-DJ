/**
 * Trust strip highlighting key product strengths.
 * Pure presentational — no business claims beyond supported facts.
 */

const items = [
  {
    icon: "🔒",
    title: "Private events",
    body: "Join via code or QR — events stay between you and your crowd.",
  },
  {
    icon: "💳",
    title: "Stripe-secure payments",
    body: "Credit purchases and payouts are processed securely by Stripe.",
  },
  {
    icon: "📱",
    title: "No app download",
    body: "Works instantly in your mobile browser — no install required.",
  },
  {
    icon: "⚡",
    title: "Real-time queue",
    body: "Bids move songs up the live queue in real time.",
  },
] as const;

/**
 * Lightweight trust strip for the marketing homepage.
 */
export function TrustStrip() {
  return (
    <section className="border-t border-edge/60">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.title}
              className="group rounded-2xl border border-edge bg-surface/50 p-5 transition hover:border-neon/40"
            >
              <span className="text-xl" aria-hidden>
                {item.icon}
              </span>
              <h3 className="mt-2 font-display text-[18px] tracking-[1px] text-foreground">
                {item.title}
              </h3>
              <p className="mt-1 text-sm leading-[1.7] text-muted">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default TrustStrip;
