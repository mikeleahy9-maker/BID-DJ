/**
 * Public marketing homepage.
 *
 * Replaces the former login-selection screen with a full landing page:
 * header nav, hero, the two experience cards (Guests / DJs & Bands),
 * how-it-works, a DJ/Band value section, an accessible FAQ and a footer.
 *
 * Uses only existing theme tokens, the shared <Logo>, the /dj-gig.svg
 * asset, and the application's real routes — no new auth or business
 * logic is introduced here.
 */

import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Faq } from "@/components/marketing/faq";
import { TrustStrip } from "@/components/marketing/trust-strip";
import { JoinVisual } from "@/components/marketing/join-visual";
import { CtaBand } from "@/components/marketing/cta-band";
import { FeaturesBenefits } from "@/components/marketing/features-benefits";
import { UseCases } from "@/components/marketing/use-cases";

export const metadata = {
  title: "BidaBeat — Own the Night. Shape the Sound.",
  description:
    "BidaBeat brings guests and DJs together through interactive music experiences. Request songs, bid for your favourites, and help shape the soundtrack of the night.",
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

const ctaPrimary = `inline-flex items-center justify-center gap-2 rounded-xl bg-neon px-6 py-3.5 text-base font-semibold text-bg shadow-[0_0_24px_rgba(0,255,225,0.25)] transition hover:opacity-90 active:scale-[0.98] ${focusRing}`;

const ctaSecondary = `inline-flex items-center justify-center gap-2 rounded-xl border border-neon/40 bg-neon/5 px-6 py-3.5 text-base font-semibold text-neon transition hover:border-neon hover:bg-neon/10 active:scale-[0.98] ${focusRing}`;

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: SectionHeadingProps) {
  return (
    <div className={align === "center" ? "text-center" : "text-left"}>
      <p className="text-xs font-semibold uppercase tracking-[3px] text-neon">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-display text-[36px] leading-[1.05] tracking-[2px] text-foreground sm:text-[44px]">
        {title}
      </h2>
      {subtitle ? (
        <p
          className={`mt-4 max-w-2xl text-base leading-[1.7] text-muted ${
            align === "center" ? "mx-auto" : ""
          }`}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function Check({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${className}`}
    >
      ✓
    </span>
  );
}

interface BulletsProps {
  items: string[];
  accentText: string;
  accentBg: string;
}

function Bullets({ items, accentText, accentBg }: BulletsProps) {
  return (
    <ul className="mt-6 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-sm text-foreground">
          <Check className={`${accentBg} ${accentText}`} />
          <span className="leading-[1.5]">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(0,255,225,0.10),transparent_55%),radial-gradient(ellipse_at_85%_25%,rgba(168,85,247,0.08),transparent_50%),radial-gradient(ellipse_at_12%_85%,rgba(255,45,120,0.08),transparent_50%)]"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-2 lg:gap-10 lg:pb-24 lg:pt-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-neon/30 bg-neon/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[2px] text-neon">
            <span className="size-1.5 rounded-full bg-neon" aria-hidden />
            Live events · Music requests
          </span>

          <h1 className="mt-6 font-display text-[52px] leading-[0.95] tracking-[2px] text-foreground sm:text-[68px] lg:text-[80px]">
            Own the Night.
            <br />
            <span className="text-neon">Shape the Sound.</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-[1.7] text-muted sm:text-lg">
            BidaBeat brings guests and DJs together through interactive music
            experiences. Request songs, bid for your favourites, and help shape
            the soundtrack of the night.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/signup" className={ctaPrimary}>
              Get Started
            </Link>
            <Link href="/dj-login" className={ctaSecondary}>
              DJ / Band Portal
            </Link>
          </div>

          <p className="mt-5 text-sm text-muted">
            Already have an account?{" "}
            <Link
              href="/login"
              className={`rounded font-semibold text-neon hover:underline ${focusRing}`}
            >
              Log In
            </Link>
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-6 rounded-[40px] bg-[radial-gradient(ellipse_at_center,rgba(0,255,225,0.18),transparent_70%)] blur-2xl"
          />
          <div className="relative overflow-hidden rounded-[28px] border border-edge bg-surface shadow-[0_24px_70px_rgba(0,0,0,0.6)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/hero-image.jpg"
              alt="DJ performing live at an event"
              width={512}
              height={512}
              className="aspect-square h-auto w-full object-cover"
            />
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-bg via-bg/70 to-transparent"
            />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-edge bg-bg/80 px-3 py-1.5 text-xs font-semibold text-foreground backdrop-blur">
                <span className="size-1.5 animate-pulse rounded-full bg-neon-2" aria-hidden />
                Live queue · Tonight
              </span>
              <span className="rounded-full border border-neon-3/40 bg-neon-3/10 px-3 py-1.5 text-xs font-semibold text-neon-3">
                🎵 Requests open
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ExperienceCards() {
  return (
    <section className="border-t border-edge/60">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeading
          eyebrow="Two ways in"
          title="The crowd and the deck, connected"
          subtitle="Whether you're here to move the night or run it, BidaBeat keeps everyone on the same beat."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-neon-2/30 bg-neon-2/[0.04] p-8 transition hover:border-neon-2/60">
            <div className="flex items-center gap-3">
              <span className="text-3xl" aria-hidden>
                🎟️
              </span>
              <span className="text-xs font-semibold uppercase tracking-[3px] text-neon-2">
                For Guests
              </span>
            </div>
            <h3 className="mt-4 font-display text-[30px] tracking-[1px] text-foreground">
              Own the moment
            </h3>
            <Bullets
              items={[
                "Purchase credits",
                "Request songs",
                "Vote on music",
                "Participate in the event experience",
              ]}
              accentText="text-neon-2"
              accentBg="bg-neon-2/15"
            />
            <Link href="/signup" className={`mt-8 ${ctaPrimary}`}>
              Get Started
            </Link>
          </article>

          <article className="rounded-2xl border border-neon-3/30 bg-neon-3/[0.04] p-8 transition hover:border-neon-3/60">
            <div className="flex items-center gap-3">
              <span className="text-3xl" aria-hidden>
                🎛️
              </span>
              <span className="text-xs font-semibold uppercase tracking-[3px] text-neon-3">
                For DJs &amp; Bands
              </span>
            </div>
            <h3 className="mt-4 font-display text-[30px] tracking-[1px] text-foreground">
              Run the room
            </h3>
            <Bullets
              items={[
                "Manage events",
                "Manage music requests & queues",
                "Engage with the audience",
                "Access earnings & payout features",
              ]}
              accentText="text-neon-3"
              accentBg="bg-neon-3/15"
            />
            <Link
              href="/dj-login"
              className={`mt-8 inline-flex items-center justify-center gap-2 rounded-xl border border-neon-3/50 bg-neon-3/10 px-6 py-3.5 text-base font-semibold text-neon-3 transition hover:bg-neon-3/20 active:scale-[0.98] ${focusRing}`}
            >
              DJ / Band Login
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}

const steps = [
  {
    icon: "💳",
    title: "Get Credits",
    body: "Guests purchase credits to participate — $1.00 each, plus bonus credits on larger packs, all processed securely through Stripe.",
  },
  {
    icon: "🎵",
    title: "Influence the Music",
    body: "Guests request songs and bid to move them up the live queue, putting the crowd in charge of what plays next.",
  },
  {
    icon: "🎧",
    title: "Bring the Night to Life",
    body: "DJs and bands run the queue, engage their audience, and keep the energy exactly where it belongs.",
  },
];

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 border-t border-edge/60"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeading
          eyebrow="How It Works"
          title="Three steps to a night that hits"
          subtitle="From first credit to final drop — here's the flow."
        />

        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="relative rounded-2xl border border-edge bg-surface/50 p-7 transition hover:border-neon/40"
            >
              <span className="font-display text-[44px] leading-none text-neon/30 absolute top-4 right-4">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="mt-3 block text-2xl" aria-hidden>
                {step.icon}
              </span>
              <h3 className="mt-3 font-display text-[24px] tracking-[1px] text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-[1.7] text-muted">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const djCapabilities = [
  "Create and manage events end to end",
  "Approve, reorder and play song requests from a live queue",
  "Keep the crowd engaged as bids shift the running order",
  "Share a private event code or QR — your event stays yours",
  "Track earnings and manage payouts through Stripe",
];

const mockQueue = [
  { title: "Midnight City", bids: 12 },
  { title: "Blinding Lights", bids: 9 },
  { title: "Levitating", bids: 7 },
];

function ForDjs() {
  return (
    <section id="for-djs" className="scroll-mt-20 border-t border-edge/60">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading
              eyebrow="For DJs & Bands"
              title="Run the queue, own the night"
              align="left"
              subtitle="BidaBeat gives DJs and bands one place to run requests, keep the floor moving, and get paid — without missing a beat."
            />

            <ul className="mt-8 space-y-3">
              {djCapabilities.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm text-foreground"
                >
                  <Check className="bg-neon-3/15 text-neon-3" />
                  <span className="leading-[1.5]">{item}</span>
                </li>
              ))}
            </ul>

            {/* <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/dj-login"
                className={`inline-flex items-center justify-center gap-2 rounded-xl bg-neon-3 px-6 py-3.5 text-base font-semibold text-bg shadow-[0_0_24px_rgba(255,230,0,0.2)] transition hover:opacity-90 active:scale-[0.98] ${focusRing}`}
              >
                DJ / Band Login
              </Link>
              <Link
                href="/dj-signup"
                className={`rounded text-sm font-semibold text-neon-3 hover:underline ${focusRing}`}
              >
                Create a DJ/Band account →
              </Link>
            </div> */}
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-6 rounded-[40px] bg-[radial-gradient(ellipse_at_center,rgba(255,230,0,0.12),transparent_70%)] blur-2xl"
            />
            <div className="relative rounded-2xl border border-edge bg-surface p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[2px] text-muted">
                  Live queue
                </span>
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-neon">
                  <span className="size-1.5 animate-pulse rounded-full bg-neon" aria-hidden />
                  On air
                </span>
              </div>
              <ul className="mt-4 space-y-2">
                {mockQueue.map((song, index) => (
                  <li
                    key={song.title}
                    className="flex items-center gap-3 rounded-xl border border-edge bg-surface-2 px-4 py-3"
                  >
                    <span className="font-display text-lg text-muted">
                      {index + 1}
                    </span>
                    <span className="truncate text-sm font-medium text-foreground">
                      {song.title}
                    </span>
                    <span className="ml-auto shrink-0 rounded-full border border-neon-2/40 bg-neon-2/10 px-2.5 py-1 text-xs font-semibold text-neon-2">
                      {song.bids} bids
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-center text-[11px] uppercase tracking-[2px] text-white/25">
                Bid the Beat · Own the Night
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <div className="relative overflow-x-hidden">
      <SiteHeader />
      <main>
        <Hero />
        <TrustStrip />
        <ExperienceCards />
        <HowItWorks />
        <FeaturesBenefits />
        <UseCases />
        <JoinVisual />
        <ForDjs />
        <Faq />
        <CtaBand />
      </main>
      <SiteFooter />
    </div>
  );
}
