"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { useToast } from "@/components/ui/use-toast";
import { getSupabaseClient } from "@/lib/supabase/client";
import { LiveBoard } from "@/features/live/components/live-board";
import { useLiveQueue, type LiveTrack } from "@/features/live/lib/use-live-queue";
import { GuestBuyModal } from "./guest-buy-modal";
import { GuestRequestSongModal, SongPick } from "./guest-request-song-modal";
import { GuestGiftTipModal } from "./guest-gift-tip-modal";
import { GuestBidAllModal } from "./guest-bid-all-modal";
import { REQUEST_COST } from "../data";

export interface GuestQueueEvent {
  id: string;
  name: string;
  djName: string;
  code: string;
}

export function GuestQueuePage({ event }: { event: GuestQueueEvent }) {
  const router = useRouter();
  const { show, toastNode } = useToast();

  const [credits, setCredits] = useState<number | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [giftTipKind, setGiftTipKind] = useState<"gift" | "tip" | null>(null);
  const [bidAllTarget, setBidAllTarget] = useState<LiveTrack | null>(null);

  const { tracks, requestSong, placeBid, placeDownBid } = useLiveQueue(event.id);

  useEffect(() => {
    let ignore = false;
    let channel: ReturnType<ReturnType<typeof getSupabaseClient>["channel"]> | null =
      null;
    (async () => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const loadBalance = async () => {
        // Must filter by user_id: without it this returns every attendee on the
        // event, maybeSingle() errors on multiple rows, and the wallet silently
        // fell back to the 20-credit starting default.
        const { data: attendee } = await supabase
          .from("attendees")
          .select("credit_balance")
          .eq("event_id", event.id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (ignore) return;
        setCredits(attendee ? Number(attendee.credit_balance) : 0);
      };

      await loadBalance();
      if (ignore) return;

      // A DJ refund pays credits back by updating this attendee row, so the
      // wallet follows it without a reload. Bids and down votes land here too.
      channel = supabase
        .channel(`guest-wallet-${event.id}-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "attendees",
            filter: `event_id=eq.${event.id}`,
          },
          (payload: { new: Record<string, unknown> }) => {
            const next = payload.new?.credit_balance;
            if (typeof next === "number") setCredits(next);
          }
        )
        .subscribe();
    })();
    return () => {
      ignore = true;
      if (channel) getSupabaseClient().removeChannel(channel);
    };
  }, [event.id]);

  const available = credits ?? 0;

  /**
   * Credits are never granted client-side — the server grants them from the
   * payment record. This only reflects the confirmed grant in the UI; the
   * authoritative balance arrives over the attendees realtime subscription.
   */
  const handlePurchased = (creditsAdded: number) => {
    setBuyOpen(false);
    show(`+${creditsAdded} credits added`);
  };

  const applyBalance = (balance: number | null, fallback: number) => {
    setCredits(balance ?? fallback);
  };

  const handleRequest = async (song: SongPick): Promise<boolean> => {
    const current = available;
    if (current < REQUEST_COST) {
      setBuyOpen(true);
      return false;
    }
    try {
      await requestSong({
        title: song.title,
        artist: song.artist,
        deezerId: song.deezerId ?? null,
        coverUrl: song.coverUrl ?? null,
        credits: REQUEST_COST,
      });
      const supabase = getSupabaseClient();
      const { data: updated } = await supabase.rpc("spend_attendee_credits", {
        p_event_id: event.id,
        p_amount: REQUEST_COST,
      });
      if (updated) {
        setCredits(Number((updated as { credit_balance: number }).credit_balance));
      } else {
        setCredits(current - REQUEST_COST);
      }
      show(`"${song.title}" sent to the DJ for approval!`);
      return true;
    } catch (err) {
      show(
        `Something went wrong — ${
          err instanceof Error ? err.message : "please try again"
        }`
      );
      return false;
    }
  };

  const runBid = async (track: LiveTrack, amount: number) => {
    const current = available;
    if (amount <= 0) {
      show("No credits left!");
      setBuyOpen(true);
      return;
    }
    if (current < amount) {
      show("Not enough credits!");
      setBuyOpen(true);
      return;
    }

    const result = await placeBid(track.id, amount);
    if (!result.ok) {
      if (result.error === "insufficient_credits") {
        show("Not enough credits!");
        setBuyOpen(true);
      } else if (result.error === "event_not_live") {
        show("This event is no longer live.");
      } else {
        show("Could not place your bid — please try again.");
      }
      return;
    }

    applyBalance(result.creditBalance, current - amount);
    show(`+${amount} 💎 on "${track.title}"!`);
  };

  const confirmBidAll = async () => {
    const track = bidAllTarget;
    setBidAllTarget(null);
    if (!track) return;
    await runBid(track, available);
  };

  const runDownBid = async (track: LiveTrack, amount: number) => {
    const current = available;
    if (current < amount) {
      show("Not enough credits!");
      setBuyOpen(true);
      return;
    }

    const result = await placeDownBid(track.id, amount);
    if (!result.ok) {
      if (result.error === "over_bid") {
        const need = result.maxDown ?? track.credits;
        show(
          `"${track.title}" only has ${track.credits} 💎 — bid ${need} to drop it to 0!`
        );
      } else if (result.error === "insufficient_credits") {
        show("Not enough credits!");
        setBuyOpen(true);
      } else if (result.error === "already_at_bottom") {
        show(`"${track.title}" is already at the bottom!`);
      } else if (result.error === "event_not_live") {
        show("This event is no longer live.");
      } else {
        show("Could not register your vote — please try again.");
      }
      return;
    }

    applyBalance(result.creditBalance, current - amount);
    show(
      `👎 Dropped "${track.title}" by ${amount} credit${
        amount === 1 ? "" : "s"
      }!`
    );
  };

  const renderBidControls = (track: LiveTrack) => {
    const atBottom = track.credits <= 0;
    return (
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "+1 💎", amount: 1, cls: "border-neon text-neon", up: true },
            { label: "+5 💎", amount: 5, cls: "border-neon-3 text-neon-3", up: true },
            { label: "-1 👎", amount: 1, cls: "border-neon-2 text-neon-2", up: false },
            { label: "-3 👎", amount: 3, cls: "border-[#aa1144] text-[#ff6699]", up: false },
          ].map((b) => {
            // A 0-credit song is already at the bottom, so both down votes are dead.
            const blocked = !b.up && (atBottom || b.amount > track.credits);
            return (
              <button
                key={b.label}
                onClick={() =>
                  blocked
                    ? show(
                        atBottom
                          ? `"${track.title}" is already at the bottom!`
                          : `"${track.title}" only has ${track.credits} 💎 — bid ${track.credits} to drop it to 0!`
                      )
                    : b.up
                      ? runBid(track, b.amount)
                      : runDownBid(track, b.amount)
                }
                className={`cursor-pointer rounded-lg border bg-surface-2 px-1 py-2 text-[11px] font-bold tracking-[0.3px] transition active:scale-[0.96] ${
                  blocked ? "border-edge text-muted/50" : b.cls
                }`}
              >
                {b.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setBidAllTarget(track)}
          className="w-full cursor-pointer rounded-lg border border-neon-3/40 bg-[linear-gradient(135deg,rgba(255,230,0,0.12),rgba(255,136,0,0.1))] px-2.5 py-[9px] text-[12px] font-extrabold tracking-[0.5px] text-neon-3 transition active:scale-[0.98] active:bg-[rgba(255,230,0,0.2)]"
        >
          🔥 BID ALL — {available} 💎
        </button>
      </div>
    );
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
          Live at {event.name}
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:items-start md:gap-6">
          {/* Main column — credits, request, queue */}
          <section className="md:col-span-2">
            {/* Credits banner (credit-banner) */}
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-edge bg-[linear-gradient(135deg,rgba(0,255,225,0.08),rgba(255,45,120,0.08))] px-4 py-4 sm:px-[18px]">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[1px] text-muted">
                  Your Credits
                </div>
                <div className="font-display text-[30px] leading-none tracking-[2px] text-neon sm:text-[36px]">
                  {available}
                </div>
              </div>
              <button
                onClick={() => setBuyOpen(true)}
                className="shrink-0 cursor-pointer border-none bg-neon-2 rounded-lg px-3 py-2.5 text-xs font-bold tracking-[0.5px] text-white sm:px-3.5"
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
                  Search any song &amp; send it to the DJ — costs 2 credits
                </span>
              </span>
              <span className="ml-auto text-xl" aria-hidden>→</span>
            </button>

            {/* Live queue */}
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <div className="min-w-0 text-[11px] uppercase tracking-[2px] text-muted">
                <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-neon-2" aria-hidden />
                Live Queue — Bid to Move Up
              </div>
              <div className="min-w-0 flex-1 truncate text-right text-[11px] text-muted sm:flex-none sm:text-left">
                {event.djName} is spinning
              </div>
            </div>

            <LiveBoard
              tracks={tracks}
              emptyText="No songs on the board yet — request one to kick things off!"
              bidControls={renderBidControls}
            />
          </section>

          {/* Right rail — generosity on desktop, stacked after queue on mobile */}
          <aside className="md:col-span-1">
            <div className="text-[11px] uppercase tracking-[2px] text-muted">
              ✨ Support the Night
            </div>
            <div className="mt-2.5 flex flex-col gap-2.5 sm:flex-row md:flex-col">
              <button
                onClick={() => setGiftTipKind("gift")}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-[#a855f7]/40 bg-[rgba(168,85,247,0.06)] px-3 py-3.5 text-left text-foreground transition active:scale-[0.97] sm:flex-1 md:w-auto md:flex-none"
              >
                <span className="shrink-0 text-[22px]" aria-hidden>🎁</span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold">Gift Credits</span>
                  <span className="mt-0.5 block truncate text-[10px] text-muted">
                    Donate $ to the event
                  </span>
                </span>
              </button>
              <button
                onClick={() => setGiftTipKind("tip")}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-neon-2/35 bg-[rgba(255,45,120,0.06)] px-3 py-3.5 text-left text-foreground transition active:scale-[0.97] sm:flex-1 md:w-auto md:flex-none"
              >
                <span className="shrink-0 text-[22px]" aria-hidden>🎛️</span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold">
                    Tip the DJ/Band
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-muted">
                    Send cash directly
                  </span>
                </span>
              </button>
            </div>
          </aside>
        </div>
      </PageContainer>

      {/* Buy Credits */}
      <GuestBuyModal
        open={buyOpen}
        onClose={() => setBuyOpen(false)}
        eventId={event.id}
        onPurchased={handlePurchased}
      />

      {/* Request a Song */}
      <GuestRequestSongModal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        credits={available}
        onRequest={handleRequest}
        onNotEnoughCredits={() => setBuyOpen(true)}
      />

      {/* BID ALL confirmation */}
      <GuestBidAllModal
        open={bidAllTarget !== null}
        songTitle={bidAllTarget?.title ?? ""}
        amount={available}
        onClose={() => setBidAllTarget(null)}
        onConfirm={confirmBidAll}
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