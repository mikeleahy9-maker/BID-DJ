"use client";

import { useEffect, useState } from "react";
import StripeConnectEmbedded from "./stripe-connect-embedded";
import { Pagination } from "@/components/ui/pagination";

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

interface EarningsData {
  period: string;
  total: number;
  gigs: number;
  songs: number;
  guests: number;
  page: number;
  pageSize: number;
  totalEvents: number;
  events: Array<{
    name: string;
    date: string;
    earned: number;
    status: string;
    reason?: string | null;
    songs: number;
    guests: number;
  }>;
}

export default function EarningsPanel() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("week");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<EarningsData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch earnings data
  useEffect(() => {
    let cancelled = false;
    setTimeout(() => setRefreshing(true), 0);
    fetch(`/api/dj/earnings?period=${period}&page=${page}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setTimeout(() => setRefreshing(false), 0);
        }
      })
      .catch(() => {
        if (!cancelled) setTimeout(() => setRefreshing(false), 0);
      });
    return () => { cancelled = true; };
  }, [period, page]);

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-surface-2 rounded w-1/4" />
          <div className="h-48 bg-surface-2 rounded" />
          <div className="grid grid-cols-3 gap-3">
            <div className="h-24 bg-surface-2 rounded" />
            <div className="h-24 bg-surface-2 rounded" />
            <div className="h-24 bg-surface-2 rounded" />
          </div>
          <div className="h-64 bg-surface-2 rounded" />
        </div>
      </div>
    );
  }

  const STATUS_TONE: Record<string, string> = {
    Settled: "text-neon",
    Processing: "text-amber-400",
    Pending: "text-muted",
    Failed: "text-red-400",
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Period selector */}
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => {
              setPeriod(p.key);
              setPage(1);
            }}
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
              period === p.key
                ? "border-neon bg-neon text-bg"
                : "border-edge bg-surface text-muted hover:text-neon"
            }`}
          >
            {p.label}
          </button>
        ))}
        {refreshing && (
          <span className="self-center text-xs text-muted">Updating…</span>
        )}
      </div>

      {/* Hero total */}
      <section className="rounded-xl border border-neon/20 bg-gradient-to-br from-neon/8 to-neon-2/6 p-6 text-center">
        <div className="text-[11px] uppercase tracking-[1px] text-muted">Received</div>
        <div className="my-2 font-display text-6xl tracking-[2px] text-neon">
          ${(data?.total ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </div>
        <div className="text-xs text-muted">
          {PERIOD_LABEL[period]} · DJ share (20%)
        </div>
      </section>

      {/* Stats row */}
      <section className="grid grid-cols-3 gap-3">
        {[
          { label: "Gigs", value: data?.gigs ?? 0 },
          { label: "Songs Played", value: (data?.songs ?? 0).toLocaleString() },
          { label: "Guests", value: (data?.guests ?? 0).toLocaleString() },
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
          {data?.events?.length > 0 ? (
            data.events.map((ev, i) => (
              <div
                key={`${ev.name}-${i}`}
                className="flex flex-wrap items-center gap-3 border-b border-edge px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold capitalize">{ev.name}</div>
                  <div className="text-[11px] text-muted">
                    {ev.date} · {ev.songs} songs · {ev.guests} guests ·{" "}
                    <span className={STATUS_TONE[ev.status] ?? "text-muted"}>{ev.status}</span>
                  </div>
                  {ev.reason ? (
                    <div className="text-[11px] text-muted/80">{ev.reason}</div>
                  ) : null}
                </div>
                <div className="font-display text-2xl text-neon">${ev.earned.toFixed(2)}</div>
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-muted">No events in this period</div>
          )}
        </div>

        {data.totalEvents > (data.pageSize ?? 10) && (
          <Pagination
            page={data.page ?? 1}
            pageCount={Math.max(
              1,
              Math.ceil((data.totalEvents ?? 0) / (data.pageSize ?? 10))
            )}
            total={data.totalEvents}
            pageSize={data.pageSize ?? 10}
            onChange={setPage}
          />
        )}
      </section>

      {/* Stripe Connect balances and payouts, embedded inline */}
      <section>
        <h2 className="mb-3 text-[11px] uppercase tracking-[2px] text-muted">
          Balance &amp; Payouts
        </h2>
        <StripeConnectEmbedded />
      </section>
    </div>
  );
}