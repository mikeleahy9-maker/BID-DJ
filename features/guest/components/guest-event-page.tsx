"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { GuestHireModal } from "./guest-hire-modal";

/**
 * GuestEventPage - faithful port of the prototype's `#screen-event`
 * (event landing page shown after a guest enters the event code).
 *
 * Mobile matches the prototype exactly:
 *   Hero  -> Back · 🎉 TONIGHT · Event name · DJ · location/time
 *   Stats -> Songs in Queue / Guests Bidding / Live Now
 *   Top   -> 🔥 Top of Queue card
 *   CTA   -> Enter the Queue (pink) + credits note
 *   Hire  -> "Available to book" DJ card → opens booking modal
 *
 * On `md+` it adapts to a web layout: stats become a full-width KPI row,
 * with the queue CTA on the left and the hire card in a right rail.
 */
export function GuestEventPage({ eventCode }: { eventCode: string }) {
  const router = useRouter();
  const [hireOpen, setHireOpen] = useState(false);

  const event = {
    badge: "🎉 TONIGHT",
    name: "The Loft",
    dj: "DJ Phantom",
    meta: "📍 The Loft Bar  ·  9 PM – 2 AM",
    queueCount: 5,
    guestCount: 24,
    topTitle: "Blinding Lights",
    topArtist: "The Weeknd · 42 credits",
  };

  const stats = [
    { value: `${event.queueCount}`, label: "Songs in Queue" },
    { value: `${event.guestCount}`, label: "Guests Bidding" },
    { value: "💎", label: "Live Now" },
  ];

  return (
    <div className="min-h-full">
      {/* ---- Event hero (event-hero) ---- */}
      <section className="relative overflow-hidden border-b border-edge bg-[linear-gradient(160deg,#0d0d0d_0%,#111_100%)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_60%_0%,rgba(0,255,225,0.1)_0%,transparent_60%),radial-gradient(ellipse_at_20%_100%,rgba(255,45,120,0.07)_0%,transparent_50%)]"
        />
        <div className="relative z-[1] mx-auto w-full max-w-7xl px-4 py-8 md:px-6 md:py-12">
          <button
            onClick={() => router.push("/dashboard")}
            className="absolute left-4 top-4 z-[2] cursor-pointer border-none bg-transparent p-0 text-[13px] text-muted transition-colors hover:text-foreground md:left-6 md:top-6"
          >
            ← Back
          </button>

          <div className="md:flex md:items-end md:justify-between md:gap-12">
            <div>
              <div className="mb-3 mt-6 inline-block rounded-full border border-neon-3 bg-neon-3/10 px-3 py-[3px] text-[10px] font-bold uppercase tracking-[2px] text-neon-3 md:mt-0">
                {event.badge}
              </div>
              <h1 className="bg-gradient-to-br from-white to-white/70 bg-clip-text font-display text-[48px] leading-none tracking-[3px] text-transparent md:text-6xl">
                {event.name}
              </h1>
              <div className="mt-1 text-sm font-semibold text-neon">
                {event.dj}
              </div>
              <div className="mt-0.5 text-xs text-muted">{event.meta}</div>
            </div>

            <div className="mt-6 hidden max-w-xs text-right text-xs leading-relaxed text-muted md:block">
              Event code: {eventCode}
            </div>
          </div>
        </div>
      </section>

      {/* ---- Body ---- */}
      <PageContainer className="py-8 md:px-6 md:py-10">
        <div className="md:grid md:grid-cols-3 md:gap-6 md:items-start">
          {/* Stats summary (event-stats) — full-width KPI row on desktop */}
          <section className="flex gap-2.5 md:col-span-3 md:gap-5">
            {stats.map((s) => (
              <div
                key={s.label}
                className="flex-1 rounded-[10px] border border-edge bg-surface p-3.5 text-center md:px-6 md:py-5"
              >
                <div className="font-display text-[26px] leading-none tracking-[1px] text-neon md:text-[32px]">
                  {s.value}
                </div>
                <div className="mt-0.5 text-[10px] text-muted md:text-[11px]">
                  {s.label}
                </div>
              </div>
            ))}
          </section>

          {/* Left column — queue CTA + credit note */}
          <section className="mt-5 flex flex-col gap-4 md:col-span-2 md:mt-6">
            {/* Top of queue (event-top-song) */}
            <div className="rounded-xl border border-neon-3/20 bg-surface px-4 py-3.5">
              <div className="mb-1.5 text-[10px] uppercase tracking-[2px] text-neon-3">
                🔥 Top of Queue
              </div>
              <div className="text-base font-bold">{event.topTitle}</div>
              <div className="mt-0.5 text-xs text-muted">
                {event.topArtist}
              </div>
            </div>

            {/* Enter the Queue (event-join-btn) */}
            <button
              onClick={() => router.push("/request")}
              className="flex w-full cursor-pointer items-center gap-3.5 rounded-xl border-none bg-[linear-gradient(135deg,#ff2d78,#cc1155)] px-[18px] py-4 text-left text-white shadow-[0_0_24px_rgba(255,45,120,0.25)] transition-transform active:scale-[0.98]"
            >
              <span className="text-2xl" aria-hidden>
                🎵
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[22px] tracking-[1.5px]">
                  Enter the Queue
                </span>
                <span className="mt-0.5 block text-[11px] opacity-85">
                  Start bidding — your card is already saved
                </span>
              </span>
              <span className="ml-auto text-xl" aria-hidden>
                →
              </span>
            </button>

            <div className="text-center text-[11px] text-muted">
              Credits are $1.00 each · Bonus on larger packs · Unused credits
              refunded at end of event
            </div>
          </section>

          {/* Right rail — hire card */}
          <section className="mt-5 md:col-span-1 md:mt-6">
            <button
              onClick={() => setHireOpen(true)}
              className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-neon-2/25 bg-[linear-gradient(135deg,rgba(255,45,120,0.08),rgba(168,85,247,0.08))] px-4 py-4 text-left transition-all active:scale-[0.98] active:border-neon-2"
            >
              <span className="flex flex-1 items-center gap-3">
                <span
                  className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border-2 border-neon-2/30 bg-surface-2 text-[32px]"
                  aria-hidden
                >
                  🎛️
                </span>
                <span>
                  <span className="mb-0.5 block text-[9px] font-bold uppercase tracking-[2px] text-neon-2">
                    Available to Book
                  </span>
                  <span className="block font-display text-[20px] leading-none tracking-[1.5px]">
                    {event.dj}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-muted">
                    Weddings · Clubs · Private Events
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-center font-display text-base leading-[1.3] tracking-[1px] text-neon-2">
                Hire
                <br />
                Me →
              </span>
            </button>
          </section>
        </div>
      </PageContainer>

      <GuestHireModal open={hireOpen} onClose={() => setHireOpen(false)} />
    </div>
  );
}