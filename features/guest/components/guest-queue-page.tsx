"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/use-toast";
import { INITIAL_QUEUE, GuestQueueItem } from "../data";
import { GuestBuyModal } from "./guest-buy-modal";
import { GuestRequestSongModal } from "./guest-request-song-modal";
import { GuestGiftTipModal } from "./guest-gift-tip-modal";

/**
 * GuestQueuePage - port of the prototype's `#screen-guest`.
 * In-event experience after a guest taps "Enter the Queue":
 * credits banner, request-song CTA, the live bid queue, and the
 * generosity section (gift credits / tip the DJ).
 *
 * Mobile matches the prototype exactly. On `md+` the queue takes the
 * main column and generosity sits in a right rail (PageContainer).
 */

const STARTING_CREDITS = 20;

export function GuestQueuePage() {
  const router = useRouter();
  const { show, toastNode } = useToast();

  const [credits, setCredits] = useState(STARTING_CREDITS);
  const [queue, setQueue] = useState<GuestQueueItem[]>(INITIAL_QUEUE);
  const [bidAll, setBidAll] = useState<GuestQueueItem | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [giftTipKind, setGiftTipKind] = useState<"gift" | "tip" | null>(null);

  const sorted = useMemo(
    () => [...queue].sort((a, b) => b.credits - a.credits),
    [queue]
  );

  const addSong = (title: string, artist: string): boolean => {
    if (credits < 2) return false;
    setCredits((c) => c - 2);
    setQueue((q) => {
      const existing = q.find(
        (s) => s.title.toLowerCase() === title.toLowerCase()
      );
      if (existing) {
        show(`Boosted "${title}" in queue!`);
        return q.map((s) =>
          s.id === existing.id ? { ...s, credits: s.credits + 2 } : s
        );
      }
      show(`"${title}" added to queue!`);
      return [
        ...q,
        { id: `ff_${Date.now()}`, title, artist, credits: 2, bidders: 1 },
      ];
    });
    return true;
  };

  const confirmBuy = (creditsToAdd: number) => {
    setCredits((c) => c + creditsToAdd);
    setBuyOpen(false);
    show(`+${creditsToAdd} credits added`);
  };

  const applyBid = (id: string, delta: number) => {
    setQueue((q) =>
      q.map((s) =>
        String(s.id) === String(id)
          ? { ...s, credits: Math.max(1, s.credits + delta) }
          : s
      )
    );
  };

  const bidSong = (id: string, amount: number) => {
    if (credits < amount) {
      show("Not enough credits!");
      setBuyOpen(true);
      return;
    }
    const song = queue.find((s) => String(s.id) === String(id));
    if (!song) return;
    setCredits((c) => c - amount);
    applyBid(id, amount);
    show(`+${amount} 💎 on "${song.title}"!`);
  };

  const bidDown = (id: string, amount: number) => {
    if (credits < amount) {
      show("Not enough credits!");
      setBuyOpen(true);
      return;
    }
    const song = queue.find((s) => String(s.id) === String(id));
    if (!song) return;
    const actualDrop = Math.min(amount, song.credits - 1);
    if (actualDrop <= 0) {
      show(`"${song.title}" is already at the bottom!`);
      return;
    }
    setCredits((c) => c - amount);
    applyBid(id, -actualDrop);
    show(`👎 Dropped "${song.title}" by ${actualDrop} credit${actualDrop !== 1 ? "s" : ""}!`);
  };

  const confirmBidAll = () => {
    if (!bidAll || credits <= 0) {
      setBidAll(null);
      return;
    }
    const all = credits;
    setQueue((q) =>
      q.map((s) =>
        String(s.id) === String(bidAll.id) ? { ...s, credits: s.credits + all } : s
      )
    );
    setCredits(0);
    setBidAll(null);
    show(`🔥 ${all} 💎 all-in on "${bidAll.title}"!`);
  };

  return (
    <div className="min-h-full">
      <PageContainer className="py-7 md:px-6 md:py-8">
        <button
          onClick={() => router.back()}
          className="mb-4 cursor-pointer border-none bg-transparent p-0 text-[13px] text-muted transition-colors hover:text-foreground"
        >
          ← Back
        </button>

        <div className="mb-5 text-[11px] uppercase tracking-[2px] text-muted">
          <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-neon-2" aria-hidden />
          Live at The Loft
        </div>

        <div className="grid gap-5 md:grid-cols-3 md:items-start md:gap-6">
          {/* Main column — credits, request, queue */}
          <section className="md:col-span-2">
            {/* Credits banner (credit-banner) */}
            <div className="mb-4 flex items-center justify-between rounded-xl border border-edge bg-[linear-gradient(135deg,rgba(0,255,225,0.08),rgba(255,45,120,0.08))] px-[18px] py-4">
              <div>
                <div className="text-[11px] uppercase tracking-[1px] text-muted">
                  Your Credits
                </div>
                <div className="font-display text-[36px] leading-none tracking-[2px] text-neon">
                  {credits}
                </div>
              </div>
              <button
                onClick={() => setBuyOpen(true)}
                className="cursor-pointer border-none bg-neon-2 rounded-lg px-3.5 py-2.5 text-xs font-bold tracking-[0.5px] text-white"
              >
                + BUY MORE
              </button>
            </div>

            {/* Request a Song (request-song-btn) */}
            <button
              onClick={() => setRequestOpen(true)}
              className="mb-[18px] flex w-full cursor-pointer items-center gap-3.5 rounded-xl border-none bg-[linear-gradient(135deg,#00ffe1,#00c9b1)] px-[18px] py-4 text-left text-bg shadow-[0_0_24px_rgba(0,255,225,0.2)] transition-transform active:scale-[0.98] active:shadow-[0_0_12px_rgba(0,255,225,0.15)]"
            >
              <span className="text-xl" aria-hidden>🎵</span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[18px] tracking-[1.5px]">
                  Request a Song
                </span>
                <span className="mt-0.5 block text-[11px] text-bg/65">
                  Search catalog &amp; add to the queue — costs 2 credits
                </span>
              </span>
              <span className="ml-auto text-xl" aria-hidden>→</span>
            </button>

            {/* Live queue */}
            <div className="mb-2.5 flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-[2px] text-muted">
                <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-neon-2" aria-hidden />
                Live Queue — Bid to Move Up
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              {sorted.map((song, i) => {
                const isTop = i === 0;
                return (
                  <div
                    key={song.id}
                    className={`relative flex items-start gap-3 overflow-hidden rounded-xl border border-edge bg-surface p-3.5 ${
                      isTop ? "border-neon-3/25" : ""
                    }`}
                  >
                    <span
                      className="absolute inset-y-0 left-0 w-[3px]"
                      style={{ backgroundColor: isTop ? "#ffe600" : "#00ffe1" }}
                      aria-hidden
                    />
                    <div
                      className={`w-7 min-w-7 pt-0.5 text-center font-display text-[30px] leading-none ${
                        isTop ? "text-neon-3" : "text-muted"
                      }`}
                    >
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{song.title}</div>
                      <div className="mb-2 mt-0.5 text-[11px] text-muted">
                        {song.artist}
                      </div>
                      <div className="flex gap-2">
                        {[
                          { label: "+1 💎", cls: "border-neon text-neon", action: () => bidSong(song.id, 1) },
                          { label: "+5 💎", cls: "border-neon-3 text-neon-3", action: () => bidSong(song.id, 5) },
                          { label: "-1 👎", cls: "border-neon-2 text-neon-2", action: () => bidDown(song.id, 1) },
                          { label: "-3 👎", cls: "border-[#aa1144] text-[#ff6699]", action: () => bidDown(song.id, 3) },
                        ].map((b) => (
                          <button
                            key={b.label}
                            onClick={b.action}
                            className={`flex-1 cursor-pointer rounded-lg border bg-surface-2 px-1.5 py-2 text-[11px] font-bold tracking-[0.3px] transition active:scale-[0.96] ${b.cls}`}
                          >
                            {b.label}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          if (credits <= 0) {
                            show("No credits left!");
                            setBuyOpen(true);
                            return;
                          }
                          setBidAll(song);
                        }}
                        className="mt-2 w-full cursor-pointer rounded-lg border border-neon-3/40 bg-[linear-gradient(135deg,rgba(255,230,0,0.12),rgba(255,136,0,0.1))] py-2.5 text-xs font-extrabold tracking-[0.5px] text-neon-3 transition active:scale-[0.98]"
                      >
                        🔥 BID ALL — {credits} 💎
                      </button>
                    </div>
                    <div className="min-w-[50px] text-right font-display text-[22px] leading-none tracking-[1px] text-neon">
                      {song.credits}
                      <span className="block font-sans text-[10px] font-normal tracking-normal text-muted">
                        credits
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Right rail — generosity on desktop, stacked after queue on mobile */}
          <aside className="md:col-span-1">
            <div className="text-[11px] uppercase tracking-[2px] text-muted">
              ✨ Support the Night
            </div>
            <div className="mt-2.5 flex gap-2.5 md:flex-col">
              <button
                onClick={() => setGiftTipKind("gift")}
                className="flex flex-1 cursor-pointer items-center gap-2.5 rounded-xl border border-[#a855f7]/40 bg-[rgba(168,85,247,0.06)] px-3 py-3.5 text-left text-foreground transition active:scale-[0.97] md:flex-none"
              >
                <span className="shrink-0 text-[22px]" aria-hidden>🎁</span>
                <span>
                  <span className="block text-[13px] font-bold">Gift Credits</span>
                  <span className="mt-0.5 block text-[10px] text-muted">
                    Donate $ to the event
                  </span>
                </span>
              </button>
              <button
                onClick={() => setGiftTipKind("tip")}
                className="flex flex-1 cursor-pointer items-center gap-2.5 rounded-xl border border-neon-2/35 bg-[rgba(255,45,120,0.06)] px-3 py-3.5 text-left text-foreground transition active:scale-[0.97] md:flex-none"
              >
                <span className="shrink-0 text-[22px]" aria-hidden>🎛️</span>
                <span>
                  <span className="block text-[13px] font-bold">
                    Tip the DJ/Band
                  </span>
                  <span className="mt-0.5 block text-[10px] text-muted">
                    Send cash directly
                  </span>
                </span>
              </button>
            </div>
          </aside>
        </div>
      </PageContainer>

      {/* Bid-all confirm */}
      <Modal open={bidAll !== null} onClose={() => setBidAll(null)} className="text-center">
        <div className="mb-3 text-[52px]" aria-hidden>🔥</div>
        <div className="mb-1 font-display text-[32px] tracking-[2px]">
          Go All In?
        </div>
        <div className="mb-1.5 text-[13px] text-muted">{bidAll ? `"${bidAll.title}"` : ""}</div>
        <div className="my-3 font-display text-[48px] tracking-[2px] text-neon">
          {credits} 💎
        </div>
        <div className="mb-6 text-xs leading-relaxed text-muted">
          All your remaining credits will go on this song.
          <br />
          This cannot be undone.
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={() => setBidAll(null)}
            className="flex-1 cursor-pointer rounded-[10px] border border-edge bg-surface-2 px-4 py-3.5 text-sm font-semibold text-muted"
          >
            Cancel
          </button>
          <button
            onClick={confirmBidAll}
            className="flex-[2] cursor-pointer rounded-[10px] border-none bg-[linear-gradient(135deg,#ffe600,#ff8800)] px-4 py-3.5 text-sm font-black text-bg"
          >
            🔥 GO ALL IN
          </button>
        </div>
      </Modal>

      {/* Buy Credits */}
      <GuestBuyModal
        open={buyOpen}
        onClose={() => setBuyOpen(false)}
        onConfirm={confirmBuy}
      />

      {/* Request a Song */}
      <GuestRequestSongModal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        credits={credits}
        onAddSong={addSong}
        onNotEnoughCredits={() => setBuyOpen(true)}
      />

      {/* Gift Credits / Tip the DJ/Band */}
      <GuestGiftTipModal
        open={giftTipKind !== null}
        kind={giftTipKind}
        onClose={() => setGiftTipKind(null)}
      />

      {toastNode}
    </div>
  );
}