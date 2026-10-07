"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { QrDisplay } from "@/components/ui/qr-display";
import { useToast } from "@/components/ui/use-toast";
import { InfiniteScrollLoader } from "@/features/dj/components/infinite-scroll-loader";
import { useInfiniteSongSearch } from "@/features/dj/lib/use-infinite-song-search";
import { PRICING, REFUND_REASONS, SeedSong } from "@/features/dj/data";
import { LiveBoard } from "@/features/live/components/live-board";
import { useLiveQueue, type LiveTrack } from "@/features/live/lib/use-live-queue";
import { getSupabaseClient } from "@/lib/supabase/client";

/** Row shape returned by the event_finance() RPC. All money figures are cents. */
interface EventFinance {
  total_revenue_cents: number;
  total_fees_cents: number;
  net_revenue_cents: number;
  purchase_count: number;
  purchaser_count: number;
  organizer_cents: number;
  organizer_gross_cents: number;
  organizer_fee_cents: number;
  dj_cents: number;
  dj_gross_cents: number;
  dj_fee_cents: number;
  platform_cents: number;
  organizer_rate: number;
  dj_rate: number;
  platform_rate: number;
  settled: boolean;
}

/** Per-recipient result from POST /api/dj/events/[eventId]/end. */
interface SettlementResult {
  status: "in_progress" | "settled" | "partial";
  totalRevenueCents: number;
  totalFeesCents: number;
  netRevenueCents: number;
  organizerCents: number;
  organizerGrossCents: number;
  organizerFeeCents: number;
  djCents: number;
  djGrossCents: number;
  djFeeCents: number;
  platformCents: number;
  organizer: { status: "pending" | "held" | "sent" | "failed"; failureReason?: string | null };
  dj: { status: "pending" | "held" | "sent" | "failed"; failureReason?: string | null };
  alreadySettled: boolean;
}

const LEG_COPY: Record<
  "pending" | "held" | "sent" | "failed",
  { label: string; tone: string }
> = {
  sent: { label: "Transferred", tone: "text-neon" },
  // One label covers both reasons a share can sit: the recipient had not
  // finished onboarding, or our own balance had not settled yet. Both are
  // retried automatically and neither loses money.
  held: { label: "Held — sending automatically", tone: "text-amber-400" },
  pending: { label: "Queued — sends after funds settle", tone: "text-amber-400" },
  failed: { label: "Failed", tone: "text-red-400" },
};

export default function QueueManager({
  appUrl,
  eventContext,
  helperMode = false,
}: {
  appUrl: string;
  eventContext?: {
    id?: string;
    name: string;
    act?: string;
    date?: string;
    time?: string;
    venue?: string;
    code: string;
    pin?: string;
    helperPin?: string;
  } | null;
  helperMode?: boolean;
}) {
  const { show, toastNode } = useToast();

  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showEndCharge, setShowEndCharge] = useState(false);
  const [ending, setEnding] = useState(false);
  const [settlement, setSettlement] = useState<SettlementResult | null>(null);
  const [showLiveQr, setShowLiveQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const [refundTarget, setRefundTarget] = useState<LiveTrack | null>(null);
  const [refundReason, setRefundReason] = useState(0);
  const [showRefund, setShowRefund] = useState(false);
  // Guest stakes on the refund target. The board's `credits` figure also
  // contains the DJ's pre-loaded seed, which is never refunded to guests,
  // so the modal needs the real ledger total to stay honest.
  const [refundStake, setRefundStake] = useState<{
    total: number;
    holders: number;
  } | null>(null);

  const [showSeed, setShowSeed] = useState(false);
  const [seedBudget, setSeedBudget] = useState(5);
  const {
    query: seedQuery,
    results: seedResults,
    searching: seedSearching,
    loadingMore: seedLoadingMore,
    hasMore: seedHasMore,
    handleSearch: handleSeedSearch,
    loadMore: loadMoreSeed,
    reset: resetSeedSearch,
  } = useInfiniteSongSearch();

  const {
    tracks,
    pending,
    approveRequest,
    rejectRequest,
    markPlayed,
    markPlayedLocal,
    removeTrackLocal,
    refundTrack,
  } = useLiveQueue(eventContext?.id ?? "");

  /**
   * Money for the event comes from credit PURCHASES, not from board activity.
   *
   * event_finance() reads revenue_cents from credit_purchases, so it correctly
   * excludes bonus credits (a $20 pack grants 23) and excludes refunded bids
   * (a bid refund returns credits but never refunds the money the guest already
   * paid). Summing board credits would do neither, and would miss guests who
   * bought credits and never bid.
   */
  const [finance, setFinance] = useState<EventFinance | null>(null);

  useEffect(() => {
    const eventId = eventContext?.id;
    if (!eventId) return;
    let ignore = false;
    (async () => {
      try {
        // The server reads any missing Stripe fees first, so the preview shows
        // the real net split (previews of purchases captured before fee
        // recording would otherwise read a $0.00 deduction).
        const res = await fetch(`/api/dj/events/${eventId}/finance`);
        if (!res.ok) return;
        const body = (await res.json().catch(() => null)) as
          | { finance?: EventFinance }
          | null;
        if (ignore || !body?.finance) return;
        setFinance(body.finance);
      } catch {
        // The preview degrades to zeroed numbers rather than blocking the DJ.
      }
    })();
    return () => {
      ignore = true;
    };
  }, [eventContext?.id, tracks.length]);

  const collected = (finance?.total_revenue_cents ?? 0) / 100;
  const fees = (finance?.total_fees_cents ?? 0) / 100;
  // What Stripe actually leaves us. The three shares are cut from this, not
  // from `collected`, because the processing fee is gone before any transfer
  // can be drawn. Computed in cents so both fallbacks stay in one unit.
  const net =
    (finance?.net_revenue_cents ??
      (finance?.total_revenue_cents ?? 0) - (finance?.total_fees_cents ?? 0)) / 100;
  const organizerCut = (finance?.organizer_cents ?? 0) / 100;
  const djCut = (finance?.dj_cents ?? 0) / 100;
  const bidabeatCut = (finance?.platform_cents ?? 0) / 100;
  // Rates are per-event (events.organizer_rate / payout_rate), so never hardcode
  // 70/20/10 in the copy — a negotiated gig can differ.
  const pct = (rate: number | undefined, fallback: number) =>
    `${Math.round((rate ?? fallback) * 1000) / 10}%`;
  const playedTracks = tracks.filter((t) => t.status === "played");
  const songsPlayed = playedTracks.length;
  const boardCount = tracks.filter((t) => t.status !== "played").length;

  const runQueueAction = async (message: string, fn: () => Promise<void>) => {
    try {
      await fn();
      show(message);
    } catch (err) {
      show(
        `Something went wrong — ${
          err instanceof Error ? err.message : "please try again"
        }`
      );
    }
  };

  const openRefund = async (song: LiveTrack) => {
    setRefundTarget(song);
    setRefundReason(0);
    setRefundStake(null);
    setShowRefund(true);

    try {
      if (helperMode) {
        const res = await fetch(
          `/api/helper-queue/refund?trackId=${encodeURIComponent(song.id)}`
        );
        if (!res.ok) throw new Error("Could not load the song's stake.");
        const data = (await res.json()) as { total?: number; holders?: number };
        setRefundStake({
          total: Number(data.total ?? 0),
          holders: Number(data.holders ?? 0),
        });
        return;
      }
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("bids")
        .select("amount, user_id")
        .eq("track_id", song.id);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as { amount: number | null; user_id: string }[];
      setRefundStake({
        total: rows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0),
        holders: new Set(rows.map((r) => r.user_id)).size,
      });
    } catch {
      setRefundStake(null);
    }
  };

  const executeRefund = async () => {
    if (!refundTarget) return;
    const song = refundTarget;
    setShowRefund(false);
    setRefundTarget(null);
    try {
      const refunded = await (async () => {
        if (helperMode) {
          const res = await fetch("/api/helper-queue/refund", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ trackId: song.id }),
          });
          const body = (await res.json().catch(() => null)) as {
            ok?: boolean;
            error?: string;
            refunded?: number;
            holders?: number;
          } | null;
          if (!res.ok || !body?.ok) {
            throw new Error(body?.error || "Could not refund the song.");
          }
          return { refunded: Number(body.refunded ?? 0), holders: Number(body.holders ?? 0) };
        }
        return refundTrack(song.id);
      })();
      removeTrackLocal(song.id);
      const who =
        refunded.holders === 0
          ? "no guest had credits on it"
          : `returned 💎${refunded.refunded} to ${refunded.holders} guest${
              refunded.holders === 1 ? "" : "s"
            }`;
      show(`"${song.title}" refunded — ${who} — "${REFUND_REASONS[refundReason].label}"`);
    } catch (err) {
      show(
        `Something went wrong — ${
          err instanceof Error ? err.message : "please try again"
        }`
      );
    }
  };

  useEffect(() => {
    return () => {
      resetSeedSearch();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seedSong = async (song: SeedSong) => {
    if (!eventContext?.id) {
      show("No live event to seed into.");
      return;
    }
    try {
      const res = await fetch(
        helperMode ? "/api/helper-queue/seed" : `/api/dj/events/${eventContext.id}/tracks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: song.title,
            artist: song.artist,
            deezerId: song.deezerId ?? null,
            image: song.image ?? null,
            credits: seedBudget,
          }),
        }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Could not seed the song.");
      }
      setShowSeed(false);
      resetSeedSearch();
      setSeedBudget(5);
      show(`🎯 "${song.title}" seeded with 💎${seedBudget}!`);
    } catch (err) {
      show(
        `Something went wrong — ${
          err instanceof Error ? err.message : "please try again"
        }`
      );
    }
  };

  const endEvent = async () => {
    if (!eventContext?.id || ending) {
      return;
    }
    setEnding(true);
    try {
      // Not the generic status PATCH: closing a live event has to move the
      // money first, so this runs settlement server-side and only then flips
      // the event to ended. The response is idempotent, so a dropped reply
      // can be retried without paying anyone twice.
      const res = await fetch(`/api/dj/events/${eventContext.id}/end`, {
        method: "POST",
      });
      const body = (await res.json().catch(() => null)) as
        | { error?: string; settlement?: SettlementResult }
        | null;

      if (!res.ok || !body?.settlement) {
        throw new Error(body?.error || "Could not end the event.");
      }

      setShowEndCharge(false);
      setSettlement(body.settlement);
      if (body.settlement.alreadySettled) {
        show("This night was already settled.");
      }
    } catch (err) {
      show(
        `Something went wrong — ${
          err instanceof Error ? err.message : "please try again"
        }`
      );
    } finally {
      setEnding(false);
    }
  };

  const copyGuestLink = () => {
    if (!eventContext) return;
    const link = `${appUrl}/join/${eventContext.code}`;
    navigator.clipboard?.writeText(link).catch(() => {});
    show(`Guest link copied: ${link}`);
  };

  const saveQrPng = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${eventContext?.code ?? "event"}-QR.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!eventContext) {
    return (
      <div className="flex flex-col gap-6">
        <section className="rounded-xl border border-edge bg-surface p-8 text-center">
          <div className="mb-3 text-[36px]" aria-hidden>
            🎚️
          </div>
          <h2 className="font-display text-xl tracking-[1.5px]">
            No gig is live right now
          </h2>
          <p className="mt-2 text-sm text-muted">
            Go live from your gigs to open the queue for guests.
          </p>
          <Link
            href="/dj/events"
            className="mt-5 inline-block rounded-lg border border-neon px-4 py-2 text-[11px] font-bold text-neon transition hover:bg-neon/10"
          >
            ⚙ Go to Gigs
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Live event details */}
      <section className="rounded-xl border border-neon-2/25 bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-neon-2/40 bg-neon-2/10 px-2.5 py-1 text-[11px] font-bold text-neon-2">
            ● LIVE
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-[11px] uppercase tracking-[1px] text-muted">Join code</span>
            <span className="rounded-lg border border-neon bg-neon/10 px-3 py-1 font-mono text-sm font-bold text-neon">
              {eventContext.code}
            </span>
          </div>
        </div>
        <div className="mt-3 min-w-0">
          <div className="truncate font-display text-xl tracking-[1.5px]">
            {eventContext.name}
          </div>
          <div className="truncate text-[11px] text-muted">
            {[eventContext.act, eventContext.date, eventContext.time, eventContext.venue]
              .filter(Boolean)
              .join(" · ") || "Live now"}
          </div>
        </div>
      </section>

      {/* Earnings + actions */}
      <section
        className={`flex flex-wrap items-center gap-4 rounded-xl border p-5 ${
          helperMode
            ? "border-edge bg-surface"
            : "border-neon/20 bg-gradient-to-br from-neon/8 to-neon-2/6"
        }`}
      >
        <div>
          <div className="text-[11px] uppercase tracking-[1px] text-muted">Collected Tonight</div>
          <div className={`font-display text-5xl tracking-[2px] ${helperMode ? "text-muted" : "text-neon"}`}>
            {helperMode ? "—" : `$${collected.toFixed(2)}`}
          </div>
          <div className="mt-1 text-xs text-muted">
            {finance?.purchaser_count ?? 0} guest
            {(finance?.purchaser_count ?? 0) !== 1 && "s"} bought credits ·{" "}
            {songsPlayed} song{songsPlayed !== 1 && "s"} played
          </div>
          {!helperMode && collected > 0 && (
            <div className="mt-2 text-[11px] text-muted">
              Splits at close: organizer ${organizerCut.toFixed(2)} · DJ $
              {djCut.toFixed(2)} · BidaBeat ${bidabeatCut.toFixed(2)}
            </div>
          )}
        </div>
        <div className="ml-auto flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            onClick={() => setShowEndConfirm(true)}
            disabled={helperMode}
            title={helperMode ? "Only the event owner can end the event" : undefined}
            className={`rounded-lg px-4 py-2 text-xs font-bold text-white transition ${
              helperMode
                ? "cursor-not-allowed bg-neon-2/30 text-white/60"
                : "bg-neon-2 hover:opacity-90"
            }`}
          >
            END EVENT & CHARGE CARDS
          </button>
        </div>
        {helperMode && (
          <p className="w-full text-[11px] text-muted">
            🔒 Queue only — only the event owner can view earnings or end the event.
          </p>
        )}
      </section>

      {/* Leaderboard */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex min-w-0 items-center gap-2 text-[11px] uppercase tracking-[2px] text-muted">
            <span className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-neon-2" aria-hidden />
            <span className="truncate">Live Leaderboard</span>
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-full border border-edge bg-surface px-3 py-1 text-[11px] text-muted sm:inline-flex">
              {boardCount} in queue
            </span>
            <button
              onClick={() => setShowLiveQr(true)}
              className="rounded-lg border border-neon px-3 py-1.5 text-[11px] font-bold text-neon transition hover:bg-neon/10"
            >
              📲 QR
            </button>
            <button
              onClick={() => setShowSeed(true)}
              className="rounded-lg border border-neon-3 px-3 py-1.5 text-[11px] font-bold text-neon-3 transition hover:bg-neon-3/10"
            >
              🎯 Seed
            </button>
          </div>
        </div>
        <LiveBoard
          tracks={tracks}
          variant="dj"
          emptyText="Queue is empty — seed a song to get started!"
          actions={(t) => (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  const message = helperMode
                    ? `"${t.title}" marked played`
                    : `"${t.title}" banked — $${(
                        Number(t.credits || 0) * PRICING.CREDIT_VALUE
                      ).toFixed(2)} earned`;
                  runQueueAction(message, async () => {
                    if (helperMode) {
                      const res = await fetch("/api/helper-queue/played", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ trackId: t.id }),
                      });
                      if (!res.ok) {
                        const body = (await res.json().catch(() => null)) as {
                          error?: string;
                        } | null;
                        throw new Error(body?.error || "Could not mark the song as played.");
                      }
                    } else {
                      await markPlayed(t.id);
                    }
                    markPlayedLocal(t.id);
                  });
                }}
                className="whitespace-nowrap rounded-lg border border-neon px-3 py-1.5 text-[11px] font-bold tracking-[0.5px] text-neon transition hover:bg-neon hover:text-bg active:bg-neon active:text-bg"
              >
                ▶ PLAYED
              </button>
              <button
                onClick={() => openRefund(t)}
                className="whitespace-nowrap rounded-lg border border-neon-2 px-3 py-1.5 text-[11px] font-bold tracking-[0.5px] text-neon-2 transition hover:bg-neon-2 hover:text-white active:bg-neon-2 active:text-white"
              >
                ↩ REFUND
              </button>
            </div>
          )}
        />
      </section>

      {/* Pending requests */}
      {pending.length > 0 && (
        <section>
          <h2 className="mb-3 text-[11px] uppercase tracking-[2px] text-neon-3">
            ⏳ Pending Requests — Needs Your Approval
          </h2>
          <div className="overflow-hidden rounded-xl border border-edge bg-surface">
            {pending.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-3 border-b border-edge px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{r.title}</div>
                  <div className="truncate text-[11px] text-muted">
                    {r.artist}
                    {r.credits > 0 && ` · +💎${r.credits}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      runQueueAction(`"${r.title}" approved — added to the queue`, async () => {
                        if (helperMode) {
                          const res = await fetch("/api/helper-queue/approve", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ requestId: r.id }),
                          });
                          if (!res.ok) {
                            const body = (await res.json().catch(() => null)) as {
                              error?: string;
                            } | null;
                            throw new Error(body?.error || "Could not approve the request.");
                          }
                          return;
                        }
                        await approveRequest(r);
                      })
                    }
                    className="rounded-lg border border-neon px-3 py-1.5 text-[11px] font-bold text-neon transition hover:bg-neon hover:text-bg"
                  >
                    ✓ APPROVE
                  </button>
                  <button
                    onClick={() =>
                      runQueueAction("Request declined", async () => {
                        if (helperMode) {
                          const res = await fetch("/api/helper-queue/reject", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ requestId: r.id }),
                          });
                          if (!res.ok) {
                            const body = (await res.json().catch(() => null)) as {
                              error?: string;
                            } | null;
                            throw new Error(body?.error || "Could not decline the request.");
                          }
                          return;
                        }
                        await rejectRequest(r);
                      })
                    }
                    className="rounded-lg border border-neon-2 px-3 py-1.5 text-[11px] font-bold text-neon-2 transition hover:bg-neon-2 hover:text-white"
                  >
                    ✕ DECLINE
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Played */}
      <section>
        <h2 className="mb-3 text-[11px] uppercase tracking-[2px] text-muted">
          ✅ Played
        </h2>
        <div className="overflow-hidden rounded-xl border border-edge bg-surface">
          {playedTracks.length === 0 && (
            <p className="p-4 text-center text-xs text-muted">No songs played yet</p>
          )}
          {playedTracks.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between border-b border-edge px-4 py-2.5 last:border-b-0"
            >
              <span className="truncate text-[13px]">
                🎵 {t.title} — {t.artist}
              </span>
              {!helperMode && (
                // Credits, not dollars: board credits are gameplay value and
                // include bonus credits and the DJ's own seed, so multiplying
                // by CREDIT_VALUE here overstated the money by up to 3x.
                <span className="shrink-0 pl-3 text-[13px] font-semibold text-neon">
                  {Number(t.credits || 0)} credits
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ---- Refund modal ---- */}
      <Modal open={showRefund} onClose={() => setShowRefund(false)}>
        <div className="mb-1 font-display text-2xl tracking-[2px]">Refund Request</div>
        {refundTarget && (
          <>
            <p className="mb-4 text-sm text-muted">
              &ldquo;{refundTarget.title}&rdquo; by {refundTarget.artist}
            </p>

            <div className="mb-4 flex flex-col gap-1.5 rounded-lg border border-edge bg-surface-2 p-3 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-muted">On the board</span>
                <span className="font-bold">
                  💎{refundTarget.credits}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Guest bids returned</span>
                <span className="font-bold text-neon">
                  {refundStake === null
                    ? "…"
                    : `💎${refundStake.total}${
                        refundStake.holders > 0
                          ? ` · ${refundStake.holders} guest${
                              refundStake.holders === 1 ? "" : "s"
                            }`
                          : ""
                      }`}
                </span>
              </div>
              <p className="pt-1 text-[11px] leading-snug text-muted">
                Every up and down bid on this song is returned to the guest who
                made it. Your pre-loaded credits are not refunded to guests and
                are not included above.
              </p>
            </div>
          </>
        )}
        <div className="flex flex-col gap-2">
          {REFUND_REASONS.map((r, i) => (
            <button
              key={i}
              onClick={() => setRefundReason(i)}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition ${
                refundReason === i
                  ? "border-neon-2 bg-neon-2/10"
                  : "border-edge bg-surface-2 hover:border-neon-2/50"
              }`}
            >
              <span className="text-lg" aria-hidden>{r.icon}</span>
              {r.label}
            </button>
          ))}
        </div>
        <button
          onClick={executeRefund}
          className="mt-5 w-full rounded-xl bg-neon-2 px-4 py-3 font-display text-lg tracking-[2px] text-white transition active:scale-[0.99]"
        >
          REFUND SONG
        </button>
      </Modal>

      {/* ---- End event confirm ---- */}
      <Modal open={showEndConfirm} onClose={() => setShowEndConfirm(false)}>
        <div className="text-center">
          <div className="mb-2 text-5xl">🚨</div>
          <div className="mb-1 font-display text-3xl tracking-[2px]">End Event?</div>
          <p className="mb-6 text-sm text-muted">
            Ending the night totals the credits bought tonight and pays them out
            to you and the organizer. This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowEndConfirm(false)}
              className="flex-1 rounded-xl border border-edge bg-surface-2 px-4 py-3 text-sm font-semibold text-muted"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setShowEndConfirm(false);
                setShowEndCharge(true);
              }}
              className="flex-1 rounded-xl bg-neon-2 px-4 py-3 text-sm font-bold text-white"
            >
              Continue →
            </button>
          </div>
        </div>
      </Modal>

      {/* ---- Charge breakdown ---- */}
      <Modal open={showEndCharge} onClose={() => !ending && setShowEndCharge(false)}>
        <div className="mb-1 font-display text-2xl tracking-[2px]">Settlement Preview</div>
        <p className="mb-4 text-xs text-muted">
          ${collected.toFixed(2)} collected from {finance?.purchase_count ?? 0} credit
          purchase{(finance?.purchase_count ?? 0) !== 1 && "s"}
        </p>
        <div className="mb-5 rounded-lg border border-neon/20 bg-neon/5 p-3 text-sm">
          <div className="flex justify-between py-0.5">
            <span className="text-muted">Total collected</span>
            <span className="font-semibold">${collected.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-muted">Stripe processing fees</span>
            <span className="font-semibold text-muted">−${fees.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-neon/20 py-0.5">
            <span className="text-muted">Net to split</span>
            <span className="font-semibold">${net.toFixed(2)}</span>
          </div>

          {[
            {
              label: `Organizer (${pct(finance?.organizer_rate, 0.7)})`,
              gross: (finance?.organizer_gross_cents ?? 0) / 100,
              fee: (finance?.organizer_fee_cents ?? 0) / 100,
              receive: organizerCut,
              tone: "text-accent",
            },
            {
              label: `DJ share (${pct(finance?.dj_rate, 0.2)})`,
              gross: (finance?.dj_gross_cents ?? 0) / 100,
              fee: (finance?.dj_fee_cents ?? 0) / 100,
              receive: djCut,
              tone: "text-neon",
            },
          ].map((party) => (
            <div key={party.label} className="mt-2 border-t border-neon/20 pt-1">
              <div className="flex justify-between py-0.5">
                <span className="text-muted">{party.label}</span>
                <span className="font-semibold text-muted">${party.gross.toFixed(2)} gross</span>
              </div>
              <div className="flex justify-between py-0.5 text-xs">
                <span className="text-muted">Their share of Stripe fees</span>
                <span className="text-muted">−${party.fee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-muted">Receives</span>
                <span className={`font-semibold ${party.tone}`}>${party.receive.toFixed(2)}</span>
              </div>
            </div>
          ))}

          <div className="flex justify-between border-t border-neon/20 py-0.5">
            <span className="text-muted">BidaBeat ({pct(finance?.platform_rate, 0.1)})</span>
            <span className="font-semibold text-muted">${bidabeatCut.toFixed(2)}</span>
          </div>
        </div>
        <p className="mb-4 text-[11px] leading-[1.6] text-muted">
          Guests were charged when they bought credits, so closing the event
          moves no money from them. Closing books the split; the organizer&apos;s{" "}
          <span className="text-accent">${organizerCut.toFixed(2)}</span> and your{" "}
          <span className="text-neon">${djCut.toFixed(2)}</span> are sent once the
          funds settle (usually a few days), and each lands in its own payout
          account and pays out on that account&apos;s schedule.
        </p>
        <button
          onClick={endEvent}
          disabled={ending}
          className="w-full rounded-xl bg-gradient-to-br from-neon-2 to-[#cc1155] px-4 py-3.5 font-display text-lg tracking-[2px] text-white transition active:scale-[0.99] disabled:opacity-60"
        >
          {ending ? "Closing…" : "⚡ CLOSE NIGHT"}
        </button>
      </Modal>

      {/* ---- Settlement receipt ---- */}
      <Modal open={!!settlement} onClose={() => setSettlement(null)}>
        {settlement && (
          <div>
            <div className="mb-1 font-display text-2xl tracking-[2px]">Night Closed</div>
            <p className="mb-4 text-xs text-muted">
              ${(settlement.netRevenueCents / 100).toFixed(2)} to split after
              ${(settlement.totalFeesCents / 100).toFixed(2)} in fees. The event is
              ended; payouts send automatically once the funds settle.
            </p>

            <div className="mb-4 rounded-lg border border-edge bg-surface-2 p-3 text-sm">
              <div className="flex justify-between py-0.5">
                <span className="text-muted">Total collected</span>
                <span className="font-semibold">
                  ${(settlement.totalRevenueCents / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-muted">Stripe processing fees</span>
                <span className="font-semibold text-muted">
                  −${(settlement.totalFeesCents / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between border-t border-edge py-0.5">
                <span className="text-muted">Net split</span>
                <span className="font-semibold">
                  ${(settlement.netRevenueCents / 100).toFixed(2)}
                </span>
              </div>

              <div className="mt-2 border-t border-edge pt-2">
                <div className="flex justify-between py-0.5 text-xs">
                  <span className="text-accent">Organizer</span>
                  <span className="font-semibold text-accent">
                    ${(settlement.organizerCents / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between py-0.5 text-[10px] text-muted">
                  <span>Gross ${(settlement.organizerGrossCents / 100).toFixed(2)} · fees −${(settlement.organizerFeeCents / 100).toFixed(2)}</span>
                  <span />
                </div>
                <div
                  className={`text-right text-[11px] ${LEG_COPY[settlement.organizer.status].tone}`}
                >
                  {LEG_COPY[settlement.organizer.status].label}
                </div>
                {settlement.organizer.status !== "sent" &&
                  settlement.organizer.failureReason && (
                    <div className="text-right text-[11px] text-muted">
                      {settlement.organizer.failureReason}
                    </div>
                  )}
              </div>

              <div className="mt-2 border-t border-edge pt-2">
                <div className="flex justify-between py-0.5 text-xs">
                  <span className="text-neon">You (DJ)</span>
                  <span className="font-semibold text-neon">
                    ${(settlement.djCents / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between py-0.5 text-[10px] text-muted">
                  <span>Gross ${(settlement.djGrossCents / 100).toFixed(2)} · fees −${(settlement.djFeeCents / 100).toFixed(2)}</span>
                  <span />
                </div>
                <div
                  className={`text-right text-[11px] ${LEG_COPY[settlement.dj.status].tone}`}
                >
                  {LEG_COPY[settlement.dj.status].label}
                </div>
                {settlement.dj.status !== "sent" && settlement.dj.failureReason && (
                  <div className="text-right text-[11px] text-muted">
                    {settlement.dj.failureReason}
                  </div>
                )}
              </div>

              <div className="mt-2 border-t border-edge pt-2">
                <div className="flex justify-between py-0.5 text-xs text-muted">
                  <span>BidaBeat (platform)</span>
                  <span className="font-semibold">
                    ${(settlement.platformCents / 100).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {settlement.status !== "settled" && (
              <p className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-[11px] leading-[1.6] text-amber-300">
                Not every share went out yet. The night is still closed and
                nothing is lost — pending and held shares send automatically
                once the funds settle or the receiving account is ready, and a
                failed transfer shows its reason above for someone to fix.
              </p>
            )}

            <button
              onClick={() => {
                setSettlement(null);
                // The event is over, so re-read the server state rather than
                // leaving a live board pointing at a closed night.
                window.location.reload();
              }}
              className="w-full rounded-xl bg-neon-2 px-4 py-3 text-sm font-bold text-white"
            >
              Done
            </button>
          </div>
        )}
      </Modal>

      {/* ---- Seed song modal ---- */}
      <Modal open={showSeed} onClose={() => setShowSeed(false)}>
        <div className="mb-1 font-display text-2xl tracking-[2px]">🎯 Seed a Song</div>
        <p className="mb-4 text-xs text-muted">Pre-load a song with starter credits</p>
        <input
          className="w-full rounded-lg border border-edge bg-surface-2 px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-neon"
          placeholder="Search for songs to seed..."
          value={seedQuery}
          onChange={(e) => handleSeedSearch(e.target.value)}
          autoFocus
        />
        <div className="mt-2 flex gap-2">
          {[5, 10, 20, 50].map((amt) => (
            <button
              key={amt}
              onClick={() => setSeedBudget(amt)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                seedBudget === amt
                  ? "border-neon-3 text-neon-3"
                  : "border-edge bg-surface-2 text-foreground hover:text-neon-3"
              }`}
            >
              💎{amt}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-col">
          {seedResults.map((s) => (
            <button
              key={s.id}
              onClick={() => seedSong(s)}
              className="flex items-center justify-between rounded-lg px-2 py-2.5 text-left transition hover:bg-surface-2"
            >
              <span className="flex min-w-0 flex-1 items-center gap-3">
                {s.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.image}
                    alt={s.title}
                    className="h-10 w-10 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-lg">
                    🎵
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{s.title}</span>
                  <span className="block truncate text-[11px] text-muted">{s.artist}</span>
                </span>
              </span>
              <span className="ml-3 text-[11px] font-bold text-neon-3">+ 💎{seedBudget}</span>
            </button>
          ))}
          <InfiniteScrollLoader
            onLoadMore={loadMoreSeed}
            loading={seedLoadingMore}
            hasMore={seedHasMore}
          />
          {seedSearching && (
            <p className="py-3 text-center text-xs text-muted">Searching…</p>
          )}
          {!seedSearching && seedQuery.trim().length >= 2 && seedResults.length === 0 && (
            <p className="py-3 text-center text-xs text-muted">No matching songs</p>
          )}
          {seedQuery.trim().length < 2 && (
            <p className="py-3 text-center text-xs text-muted">Start typing to search</p>
          )}
        </div>
      </Modal>

      {/* ---- Live QR modal ---- */}
      <Modal open={showLiveQr} onClose={() => setShowLiveQr(false)}>
        <div className="text-center">
          <div className="mb-1 font-display text-2xl tracking-[2px]">Join Tonight</div>
          <p className="mb-4 text-xs text-muted">Scan to join the live queue</p>
          <div className="flex justify-center">
            <QrDisplay
              value={`${appUrl}/join/${eventContext.code}`}
              size={190}
              onDataUrl={setQrDataUrl}
            />
          </div>
          <div className="mt-3 font-display text-3xl tracking-[8px] text-neon">
            {eventContext.code}
          </div>
          {eventContext && (
            <div className="mt-1 text-xs text-muted">{eventContext.name}</div>
          )}
          <div className="mt-1 text-xs text-muted">
            Guest PIN: <b className="text-neon">{eventContext.pin || "—"}</b>
            {" · "}Helper PIN: <b className="text-neon">{eventContext.helperPin || "—"}</b>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={copyGuestLink}
              className="flex-1 rounded-lg border border-edge bg-surface-2 px-3 py-2.5 text-xs font-bold text-foreground transition hover:border-neon hover:text-neon"
            >
              📋 Copy URL
            </button>
            <button
              onClick={saveQrPng}
              disabled={!qrDataUrl}
              title="Download this QR code as a PNG image"
              className="flex-1 rounded-lg border border-neon/40 bg-neon/5 px-3 py-2.5 text-xs font-bold text-neon transition hover:border-neon hover:bg-neon/15 active:scale-95 disabled:opacity-40"
            >
              ⬇️ Save PNG
            </button>
          </div>
        </div>
      </Modal>

      {toastNode}
    </div>
  );
}