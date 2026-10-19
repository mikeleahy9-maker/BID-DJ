/**
 * Use Cases section — common event types where BidaBeat fits.
 */

const useCases = [
  {
    title: "Clubs",
    body: "Keep the dance floor moving with a crowd-driven queue all night long.",
    accent: "neon-2",
  },
  {
    title: "Weddings",
    body: "Let guests request the songs that matter most for your special day.",
    accent: "neon",
  },
  {
    title: "Parties",
    body: "From birthdays to house parties, everyone gets a say in the soundtrack.",
    accent: "neon-3",
  },
  {
    title: "Bars",
    body: "Drive engagement and keep patrons on the floor between sets.",
    accent: "neon",
  },
  {
    title: "Private Events",
    body: "Code/QR-only access keeps your event private and curated.",
    accent: "neon-2",
  },
  {
    title: "Bands & DJs",
    body: "Manage requests seamlessly while staying focused on the performance.",
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
 * Use Cases section.
 */
export function UseCases() {
  return (
    <section className="border-t border-edge/60">
      <div className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(255,45,120,0.06),transparent_55%)]"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[3px] text-neon">
              Use Cases
            </p>
            <h2 className="mt-3 font-display text-[36px] leading-[1.05] tracking-[2px] text-foreground sm:text-[44px]">
              Clubs, weddings, parties and more
            </h2>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {useCases.map((useCase) => {
              const a = accentMap[useCase.accent];
              return (
                <div
                  key={useCase.title}
                  className={`group relative rounded-2xl border ${a.border} ${a.bg} p-8 shadow-[0_20px_60px_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5 hover:border-neon/60`}
                >
                  <div
                    aria-hidden
                    className={`pointer-events-none absolute -top-4 right-8 size-16 rounded-full ${a.glow} blur-2xl transition group-hover:opacity-100`}
                  />
                  <h3 className="relative font-display text-[20px] tracking-[1px] text-foreground md:text-[22px]">
                    {useCase.title}
                  </h3>
                  <p className="relative mt-3 text-sm leading-[1.8] text-muted">
                    {useCase.body}
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

export default UseCases;
