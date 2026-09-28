"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { QrDisplay } from "@/components/ui/qr-display";
import { useToast } from "@/components/ui/use-toast";
import { searchDeezerSongs } from "@/features/dj/lib/deezer";
import { PRICING, REFUND_REASONS, SeedSong } from "@/features/dj/data";
import { LiveBoard } from "@/features/live/components/live-board";
import { useLiveQueue, type LiveTrack } from "@/features/live/lib/use-live-queue";
import { getSupabaseClient } from "@/lib/supabase/client";

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
  const [showLiveQr, setShowLiveQr] = useState(false);

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
  const [seedQuery, setSeedQuery] = useState("");
  const [seedBudget, setSeedBudget] = useState(5);
  const [seedResults, setSeedResults] = useState<SeedSong[]>([]);
  const [seedSearching, setSeedSearching] = useState(false);
  const seedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    tracks,
    pending,
    approveRequest,
    rejectRequest,
    markPlayed,
    refundTrack,
  } = useLiveQueue(eventContext?.id ?? "");

  const playedTracks = tracks.filter((t) => t.status === "played");
  const earned =
    playedTracks.reduce((sum, t) => sum + Number(t.credits || 0), 0) *
    PRICING.CREDIT_VALUE;
  const songsPlayed = playedTracks.length;
  const boardCount = tracks.filter((t) => t.status !== "played").length;

  const totalCredits = tracks.reduce(
    (sum, t) => sum + Number(t.credits || 0),
    0
  );
  const totalCollected = totalCredits * PRICING.CREDIT_VALUE;
  const djCut = totalCollected * PRICING.DJ_PCT;
  const organizerCut = totalCollected * PRICING.ORGANIZER_PCT;
  const bidabeatCut = totalCollected * PRICING.BIDABEAT_PCT;

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
      const { refunded, holders } = await refundTrack(song.id);
      const who =
        holders === 0
          ? "no guest had credits on it"
          : `returned 💎${refunded} to ${holders} guest${
              holders === 1 ? "" : "s"
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
      if (seedTimerRef.current) clearTimeout(seedTimerRef.current);
    };
  }, []);

  const handleSeedSearch = (value: string) => {
    setSeedQuery(value);
    const q = value.trim();
    if (seedTimerRef.current) clearTimeout(seedTimerRef.current);
    if (q.length < 2) {
      setSeedResults([]);
      setSeedSearching(false);
      return;
    }
    setSeedSearching(true);
    seedTimerRef.current = setTimeout(async () => {
      const results = await searchDeezerSongs(q);
      setSeedResults(results);
      setSeedSearching(false);
    }, 700);
  };

  const seedSong = async (song: SeedSong) => {
    if (!eventContext?.id) {
      show("No live event to seed into.");
      return;
    }
    try {
      const res = await fetch(`/api/dj/events/${eventContext.id}/tracks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: song.title,
          artist: song.artist,
          deezerId: song.deezerId ?? null,
          image: song.image ?? null,
          credits: seedBudget,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Could not seed the song.");
      }
      setShowSeed(false);
      setSeedQuery("");
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
    if (!eventContext?.id) {
      setShowEndCharge(false);
      show("No live event to close.");
      return;
    }
    try {
      const res = await fetch(`/api/dj/events/${eventContext.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ended" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Could not end the event.");
      }
      setShowEndCharge(false);
      show("Event ended — DJ payout queued");
    } catch (err) {
      show(
        `Something went wrong — ${
          err instanceof Error ? err.message : "please try again"
        }`
      );
    }
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
      <section className="flex flex-wrap items-center gap-3 rounded-xl border border-neon-2/25 bg-surface p-4">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-neon-2/40 bg-neon-2/10 px-2.5 py-1 text-[11px] font-bold text-neon-2">
          ● LIVE
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-xl tracking-[1.5px]">
            {eventContext.name}
          </div>
          <div className="text-[11px] text-muted">
            {[eventContext.act, eventContext.date, eventContext.time, eventContext.venue]
              .filter(Boolean)
              .join(" · ") || "Live now"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[1px] text-muted">Join code</span>
          <span className="rounded-lg border border-neon bg-neon/10 px-3 py-1 font-mono text-sm font-bold text-neon">
            {eventContext.code}
          </span>
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
          <div className="text-[11px] uppercase tracking-[1px] text-muted">Tonight&apos;s Earnings</div>
          <div className={`font-display text-5xl tracking-[2px] ${helperMode ? "text-muted" : "text-neon"}`}>
            {helperMode ? "—" : `$${earned.toFixed(2)}`}
          </div>
          <div className="mt-1 text-xs text-muted">
            {songsPlayed} song{songsPlayed !== 1 && "s"} played
          </div>
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[11px] uppercase tracking-[2px] text-muted">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-neon-2" aria-hidden />
            Live Leaderboard
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-edge bg-surface px-3 py-1 text-[11px] text-muted">
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
                onClick={() =>
                  runQueueAction(`"${t.title}" banked — $${(
                    Number(t.credits || 0) * PRICING.CREDIT_VALUE
                  ).toFixed(2)} earned`, () => markPlayed(t.id))
                }
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
                      runQueueAction(`"${r.title}" approved — added to the queue`, () =>
                        approveRequest(r)
                      )
                    }
                    className="rounded-lg border border-neon px-3 py-1.5 text-[11px] font-bold text-neon transition hover:bg-neon hover:text-bg"
                  >
                    ✓ APPROVE
                  </button>
                  <button
                    onClick={() =>
                      runQueueAction("Request declined", () => rejectRequest(r))
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

      {/* Played & banked */}
      <section>
        <h2 className="mb-3 text-[11px] uppercase tracking-[2px] text-muted">
          ✅ Played & Banked
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
                <span className="shrink-0 pl-3 text-[13px] font-semibold text-neon">
                  +${(Number(t.credits || 0) * PRICING.CREDIT_VALUE).toFixed(2)}
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
            Ending tonight charges every guest&apos;s card for credits spent. This cannot be undone.
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
      <Modal open={showEndCharge} onClose={() => setShowEndCharge(false)}>
        <div className="mb-1 font-display text-2xl tracking-[2px]">Charges to Process</div>
        <p className="mb-4 text-xs text-muted">
          ${totalCollected.toFixed(2)} from {totalCredits.toLocaleString()} credits on the board
        </p>
        <div className="mb-5 rounded-lg border border-neon/20 bg-neon/5 p-3 text-sm">
          <div className="flex justify-between py-0.5">
            <span className="text-muted">Total collected</span>
            <span className="font-semibold">${totalCollected.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-muted">DJ share (20%)</span>
            <span className="font-semibold text-neon">${djCut.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-muted">Organizer (70%)</span>
            <span className="font-semibold text-accent">${organizerCut.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-muted">BidaBeat (10%)</span>
            <span className="font-semibold text-muted">${bidabeatCut.toFixed(2)}</span>
          </div>
        </div>
        <button
          onClick={endEvent}
          className="w-full rounded-xl bg-gradient-to-br from-neon-2 to-[#cc1155] px-4 py-3.5 font-display text-lg tracking-[2px] text-white transition active:scale-[0.99]"
        >
          ⚡ RUN CHARGES & CLOSE NIGHT
        </button>
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
        </div>
      </Modal>

      {toastNode}
    </div>
  );
}