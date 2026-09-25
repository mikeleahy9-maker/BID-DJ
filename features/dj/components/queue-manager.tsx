"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { QrDisplay } from "@/components/ui/qr-display";
import { useToast } from "@/components/ui/use-toast";
import { searchDeezerSongs } from "@/features/dj/lib/deezer";
import {
  INITIAL_QUEUE,
  PENDING_REQUESTS,
  GUEST_SPENDING,
  REFUND_REASONS,
  PRICING,
  QueueItem,
  SeedSong,
} from "@/features/dj/data";

interface PlayedLog {
  text: string;
  amount?: string;
  refunded?: boolean;
}

/**
 * Live Queue manager — the prototype's "Live" tab, desktop rework.
 * Leaderboard with play/refund, played & banked log, pending approvals,
 * and the end-of-event charge flow.
 */

export default function QueueManager({
  appUrl,
  eventContext,
  helperMode = false,
}: {
  appUrl: string;
  eventContext?: { name: string; code: string };
  helperMode?: boolean;
}) {
  const { show, toastNode } = useToast();

  const [queue, setQueue] = useState<QueueItem[]>(INITIAL_QUEUE);
  const [pending, setPending] = useState(PENDING_REQUESTS);
  const [playedLog, setPlayedLog] = useState<PlayedLog[]>([]);
  const [earned, setEarned] = useState(0);
  const [songsPlayed, setSongsPlayed] = useState(0);

  const [refundTarget, setRefundTarget] = useState<QueueItem | null>(null);
  const [refundReason, setRefundReason] = useState(0);
  const [showRefund, setShowRefund] = useState(false);

  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showEndCharge, setShowEndCharge] = useState(false);
  const [showLiveQr, setShowLiveQr] = useState(false);

  const [showSeed, setShowSeed] = useState(false);
  const [seedQuery, setSeedQuery] = useState("");
  const [seedBudget, setSeedBudget] = useState(5);
  const [seedResults, setSeedResults] = useState<SeedSong[]>([]);
  const [seedSearching, setSeedSearching] = useState(false);
  const seedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sorted = [...queue].sort((a, b) => b.credits - a.credits);
  const rankCls = ["text-neon-3", "text-gray-300", "text-[#cd7f32]"];

  const markPlayed = (id: string) => {
    const song = queue.find((s) => String(s.id) === String(id));
    if (!song) return;
    setQueue((prev) => prev.filter((s) => String(s.id) !== String(id)));
    const amount = song.credits * PRICING.CREDIT_VALUE;
    setEarned((e) => e + amount);
    setSongsPlayed((n) => n + 1);
    setPlayedLog((log) => [
      ...log,
      { text: `🎵 ${song.title} — ${song.artist}`, amount: `+$${amount.toFixed(2)}` },
    ]);
    show(`"${song.title}" banked — $${amount.toFixed(2)} earned`);
  };

  const openRefund = (song: QueueItem) => {
    setRefundTarget(song);
    setRefundReason(0);
    setShowRefund(true);
  };

  const executeRefund = () => {
    if (!refundTarget) return;
    const song = refundTarget;
    setQueue((prev) => prev.filter((s) => String(s.id) !== String(song.id)));
    setPlayedLog((log) => [
      ...log,
      { text: `↩ ${song.title} — refunded`, refunded: true },
    ]);
    setShowRefund(false);
    setRefundTarget(null);
    show(`Refunded 💎${song.credits} — "${REFUND_REASONS[refundReason].label}"`);
  };

  const approvePending = (id: string) => {
    setPending((prev) => prev.filter((r) => r.id !== id));
    show("Request approved — added to queue (demo)");
  };
  const declinePending = (id: string) => {
    setPending((prev) => prev.filter((r) => r.id !== id));
    show("Request declined — credits refunded");
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

  const seedSong = (song: SeedSong) => {
    setQueue((prev) => {
      const existing = prev.find((q) => String(q.id) === String(song.id));
      if (existing) {
        return prev.map((q) =>
          String(q.id) === String(song.id)
            ? { ...q, credits: q.credits + seedBudget }
            : q
        );
      }
      return [{ ...song, credits: seedBudget, bidders: 0, seeded: true }, ...prev];
    });
    setShowSeed(false);
    setSeedQuery("");
    setSeedBudget(5);
    show(`🎯 "${song.title}" seeded with 💎${seedBudget}!`);
  };

  const totalCollected =
    Object.values(GUEST_SPENDING).reduce((a, b) => a + b, 0) * PRICING.CREDIT_VALUE;
  const djCut = totalCollected * PRICING.DJ_PCT;
  const organizerCut = totalCollected * PRICING.ORGANIZER_PCT;
  const bidabeatCut = totalCollected * PRICING.BIDABEAT_PCT;

  return (
    <div className="flex flex-col gap-6">
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
        <div className="ml-auto flex flex-col gap-2 sm:flex-row">
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
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[11px] uppercase tracking-[2px] text-muted">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-neon-2" aria-hidden />
            Live Leaderboard
          </h2>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-edge bg-surface px-3 py-1 text-[11px] text-muted">
              {sorted.length} in queue
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
        <div className="flex flex-col gap-2.5">
          {sorted.length === 0 && (
            <p className="rounded-xl border border-edge bg-surface p-5 text-center text-xs text-muted">
              Queue is empty — seed a song to get started!
            </p>
          )}
          {sorted.map((s, i) => (
            <div
              key={s.id}
              className="relative overflow-hidden rounded-xl border border-edge bg-surface p-4"
            >
              <div
                aria-hidden
                className={`absolute inset-y-0 left-0 w-[3px] ${rankCls[i] ?? "bg-edge"}`}
              />
              <div className="flex flex-wrap items-center gap-3">
                <div className={`font-display text-3xl ${rankCls[i] ?? "text-muted"}`}>
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold">{s.title}</span>
                    {s.seeded && (
                      <span className="rounded bg-neon-3/10 px-1.5 py-0.5 text-[10px] font-bold text-neon-3">
                        🎯 SEEDED
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[11px] text-muted">{s.artist}</div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    👥 {s.bidders} bidder{s.bidders !== 1 && "s"} · 💎{s.credits} credits
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => markPlayed(s.id)}
                    className="rounded-lg border border-neon px-3 py-1.5 text-[11px] font-bold text-neon transition hover:bg-neon hover:text-bg"
                  >
                    ▶ PLAYED
                  </button>
                  <button
                    onClick={() => openRefund(s)}
                    className="rounded-lg border border-neon-2 px-3 py-1.5 text-[11px] font-bold text-neon-2 transition hover:bg-neon-2 hover:text-white"
                  >
                    ↩ REFUND
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
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
                  <div className="truncate text-[11px] text-muted">{r.artist}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => approvePending(r.id)}
                    className="rounded-lg border border-neon px-3 py-1.5 text-[11px] font-bold text-neon transition hover:bg-neon hover:text-bg"
                  >
                    ✓ APPROVE
                  </button>
                  <button
                    onClick={() => declinePending(r.id)}
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
          {playedLog.length === 0 && (
            <p className="p-4 text-center text-xs text-muted">No songs played yet</p>
          )}
          {playedLog.map((entry, i) => (
            <div
              key={i}
              className="flex items-center justify-between border-b border-edge px-4 py-2.5 last:border-b-0"
            >
              <span className={`truncate text-[13px] ${entry.refunded ? "opacity-50" : ""}`}>
                {entry.text}
              </span>
              {!helperMode && entry.amount ? (
                <span className="shrink-0 pl-3 text-[13px] font-semibold text-neon">
                  {entry.amount}
                </span>
              ) : !helperMode && entry.refunded ? (
                <span className="shrink-0 pl-3 text-xs font-semibold text-neon-2">refunded</span>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* ---- Refund modal ---- */}
      <Modal open={showRefund} onClose={() => setShowRefund(false)}>
        <div className="mb-1 font-display text-2xl tracking-[2px]">Refund Request</div>
        {refundTarget && (
          <p className="mb-4 text-sm text-muted">
            &ldquo;{refundTarget.title}&rdquo; by {refundTarget.artist} · 💎{refundTarget.credits}{" "}
            credits
          </p>
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
          REFUND — 💎{refundTarget?.credits ?? 0}
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
        <p className="mb-4 text-xs text-muted">Per-guest breakout — processed via Stripe</p>
        <div className="mb-4 flex flex-col">
          {Object.entries(GUEST_SPENDING).map(([name, credits]) => (
            <div
              key={name}
              className="flex items-center justify-between border-b border-edge py-2.5 text-sm last:border-b-0"
            >
              <span>👤 {name}</span>
              <span className="font-semibold text-neon">
                ${(credits * PRICING.CREDIT_VALUE).toFixed(2)}{" "}
                <span className="text-[11px] text-muted">({credits} credits)</span>
              </span>
            </div>
          ))}
        </div>
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
          onClick={() => {
            setShowEndCharge(false);
            setQueue([]);
            setPlayedLog((log) => [
              ...log,
              { text: `🏁 Night over — $${djCut.toFixed(2)} to your bank in 2–3 days` },
            ]);
            show(`✅ Event ended — $${djCut.toFixed(2)} DJ payout queued`);
          }}
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
          placeholder="Search Deezer for songs to seed..."
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
            <p className="py-3 text-center text-xs text-muted">Searching Deezer…</p>
          )}
          {!seedSearching && seedQuery.trim().length >= 2 && seedResults.length === 0 && (
            <p className="py-3 text-center text-xs text-muted">No matching songs</p>
          )}
          {seedQuery.trim().length < 2 && (
            <p className="py-3 text-center text-xs text-muted">Start typing to search Deezer</p>
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
              value={`${appUrl}/join/${eventContext?.code ?? "LOFT22"}`}
              size={190}
            />
          </div>
          <div className="mt-3 font-display text-3xl tracking-[8px] text-neon">
            {eventContext?.code ?? "LOFT22"}
          </div>
          {eventContext && (
            <div className="mt-1 text-xs text-muted">{eventContext.name}</div>
          )}
          <div className="mt-1 text-xs text-muted">Guest PIN: <b className="text-neon">5678</b> · Helper PIN: <b className="text-neon">9999</b></div>
        </div>
      </Modal>

      {toastNode}
    </div>
  );
}