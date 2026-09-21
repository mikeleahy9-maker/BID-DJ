"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { EARNINGS_HISTORY } from "@/features/dj/data";

const PERIODS = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
  { key: "all", label: "All Time" },
] as const;

const PERIOD_LABEL: Record<string, string> = {
  week: "Last 7 days",
  month: "Last 30 days",
  year: "Last 12 months",
  all: "All Time",
};

/**
 * Earnings overview — the prototype's Earnings tab.
 */

export default function EarningsPanel() {
  const { show, toastNode } = useToast();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("week");
  const data = EARNINGS_HISTORY[period];

  return (
    <div className="flex flex-col gap-6">
      {/* Period selector */}
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
              period === p.key
                ? "border-neon bg-neon text-bg"
                : "border-edge bg-surface text-muted hover:text-neon"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Hero total */}
      <section className="rounded-xl border border-neon/20 bg-gradient-to-br from-neon/8 to-neon-2/6 p-6 text-center">
        <div className="text-[11px] uppercase tracking-[1px] text-muted">Total Earned</div>
        <div className="my-2 font-display text-6xl tracking-[2px] text-neon">
          ${data.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </div>
        <div className="text-xs text-muted">{PERIOD_LABEL[period]} · DJ share (20%)</div>
      </section>

      {/* Stats row */}
      <section className="grid grid-cols-3 gap-3">
        {[
          { label: "Gigs", value: data.gigs },
          { label: "Songs Played", value: data.songs.toLocaleString() },
          { label: "Guests", value: data.guests.toLocaleString() },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-edge bg-surface p-4 text-center">
            <div className="font-display text-3xl tracking-[1px] text-neon-3">{s.value}</div>
            <div className="mt-1 text-[10px] uppercase tracking-[1px] text-muted">{s.label}</div>
          </div>
        ))}
      </section>

      {/* Per-event breakdown */}
      <section>
        <h2 className="mb-3 text-[11px] uppercase tracking-[2px] text-muted">
          Per Event Breakdown
        </h2>
        <div className="overflow-hidden rounded-xl border border-edge bg-surface">
          {data.events.map((ev, i) => (
            <div
              key={`${ev.name}-${i}`}
              className="flex flex-wrap items-center gap-3 border-b border-edge px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{ev.name}</div>
                <div className="text-[11px] text-muted">{ev.date} · {ev.songs} songs</div>
              </div>
              <div className="font-display text-2xl text-neon">${ev.earned.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Payout */}
      <section className="rounded-xl border border-edge bg-surface p-5 text-center">
        <button
          onClick={() => show("Payout initiated — arrives in 2–3 business days")}
          className="w-full rounded-xl bg-gradient-to-br from-neon to-[#00c9b1] px-4 py-3.5 font-display text-lg tracking-[2px] text-bg transition active:scale-[0.99]"
        >
          💸 Request Payout
        </button>
        <p className="mt-3 text-[11px] text-muted">
          Payouts go to your linked bank account · BidaBeat manages all payments via Stripe
          Connect
        </p>
      </section>

      {toastNode}
    </div>
  );
}