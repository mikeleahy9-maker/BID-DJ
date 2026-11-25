"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { LiveTrack } from "../lib/use-live-queue";

interface LiveBoardProps {
  tracks: LiveTrack[];
  variant?: "dj" | "guest";
  actions?: (track: LiveTrack) => React.ReactNode;
  /** Guest-only: the +1 / +5 / -1 / -3 bid ladder under each queued song. */
  bidControls?: (track: LiveTrack) => React.ReactNode;
  /**
   * Guest bidding only. Holds the visible row order for a moment after a bid
   * so a second tap lands on the same song instead of whichever song moved
   * into that slot. The DJ's board stays instantly live.
   */
  holdOrderWhileBidding?: boolean;
  emptyText?: string;
}

const RANK_BARS = ["#ffe600", "#aaa", "#cd7f32"];

/** Quiet period after the last tap / credit change before rows re-sort. */
const ORDER_HOLD_MS = 2000;
/** Hard ceiling so a busy room cannot freeze the board forever. */
const MAX_ORDER_HOLD_MS = 8000;

export function LiveBoard({
  tracks,
  variant = "guest",
  actions,
  bidControls,
  holdOrderWhileBidding = false,
  emptyText = "No songs on the board yet",
}: LiveBoardProps) {
  const now = tracks.find((t) => t.status === "playing");
  const queued = tracks
    .filter((t) => t.status === "queued")
    .sort((a, b) => b.credits - a.credits);
  const sorted = now ? [now, ...queued] : queued;

  // While a guest is tapping a bid ladder, keep rows in the order they were
  // displayed when the first tap happened. Credit numbers still update live;
  // only the row positions are held, then released after a short quiet period.
  const [pinnedOrder, setPinnedOrder] = useState<string[] | null>(null);
  const displayedIds = useRef<string[]>([]);
  const holdStartedAt = useRef(0);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRelease = useCallback(() => {
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    const elapsed = holdStartedAt.current ? Date.now() - holdStartedAt.current : 0;
    const delay = Math.max(0, Math.min(ORDER_HOLD_MS, MAX_ORDER_HOLD_MS - elapsed));
    releaseTimer.current = setTimeout(() => {
      setPinnedOrder(null);
      holdStartedAt.current = 0;
      releaseTimer.current = null;
    }, delay);
  }, []);

  const holdOrder = useCallback(() => {
    if (!holdOrderWhileBidding) return;
    if (!holdStartedAt.current) holdStartedAt.current = Date.now();
    setPinnedOrder([...displayedIds.current]);
    scheduleRelease();
  }, [holdOrderWhileBidding, scheduleRelease]);

  useEffect(() => {
    return () => {
      if (releaseTimer.current) clearTimeout(releaseTimer.current);
    };
  }, []);

  // A slow bid can arrive after the initial window. Restart the quiet period
  // when credits actually change so the rows stay put until the burst is over.
  const creditsSignature = tracks.map((t) => `${t.id}:${t.credits}`).join("|");
  useEffect(() => {
    if (!pinnedOrder || !holdOrderWhileBidding) return;
    scheduleRelease();
  }, [creditsSignature, pinnedOrder, holdOrderWhileBidding, scheduleRelease]);

  const list = pinnedOrder
    ? [
        ...pinnedOrder
          .map((id) => sorted.find((t) => t.id === id))
          .filter((t): t is LiveTrack => Boolean(t)),
        ...sorted.filter((t) => !pinnedOrder.includes(t.id)),
      ]
    : sorted;

  useEffect(() => {
    displayedIds.current = list.map((t) => t.id);
  });

  if (list.length === 0) {
    return <p className="p-4 text-center text-xs text-muted">{emptyText}</p>;
  }

  // Mobile/tablet: no nested scroller. The board grows naturally and the page
  // scrolls as one, so guests can always scroll back up to their credits and
  // Buy Credits. The bounded scroller is only for the md+ two-column layout,
  // where the queue has to stay inside its own column.
  return (
    <div className="flex flex-col gap-2.5 pr-1 md:max-h-[60vh] md:overflow-y-auto md:overscroll-contain">
      {list.map((t, i) => {
        const isTop = i === 0;
        const bar = isTop ? "#ffe600" : RANK_BARS[i] ?? "#2a2a2a";

        if (variant === "dj") {
          return (
            <div
              key={t.id}
              className="relative flex shrink-0 flex-col gap-3 overflow-hidden rounded-xl border border-edge bg-surface p-3.5 sm:flex-row sm:items-center"
            >
              <span
                className="absolute inset-y-0 left-0 w-[3px]"
                style={{ backgroundColor: bar }}
                aria-hidden
              />
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div
                  className={`w-7 min-w-7 text-center font-display text-[28px] leading-none ${
                    isTop ? "text-neon-3" : "text-muted"
                  }`}
                >
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{t.title}</span>
                    {isTop && Boolean(now) && (
                      <span className="shrink-0 rounded bg-neon/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-neon">
                        ▶ NOW PLAYING
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-muted">{t.artist}</div>
                  <div className="mt-[3px] text-[11px] text-muted">
                    👥 {t.bidders} {t.bidders === 1 ? "bidder" : "bidders"} · 💎{" "}
                    {t.credits} credits
                  </div>
                </div>
              </div>
              {actions && (
                <>
                  <div className="flex flex-wrap gap-2 sm:hidden">{actions(t)}</div>
                  <div className="hidden shrink-0 flex-col items-end gap-2 sm:flex">
                    {actions(t)}
                  </div>
                </>
              )}
            </div>
          );
        }

        return (
          <div
            key={t.id}
            className={`relative flex shrink-0 items-start gap-3 overflow-hidden rounded-xl border bg-surface p-3.5 ${
              isTop ? "border-neon-3/25" : "border-edge"
            }`}
          >
            <span
              className="absolute inset-y-0 left-0 w-[3px]"
              style={{ backgroundColor: bar }}
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
              <div className="truncate text-sm font-semibold">{t.title}</div>
              <div
                className={`flex items-center gap-1.5 ${
                  bidControls ? "mt-0.5 mb-2.5" : "mt-0.5"
                }`}
              >
                <div className="truncate text-[11px] text-muted">{t.artist}</div>
                {/* Same cached counter the DJ sees, so both views agree. */}
                {t.bidders > 0 && (
                  <div className="shrink-0 text-[11px] text-muted">
                    · 👥 {t.bidders}
                  </div>
                )}
              </div>
              {bidControls &&
                (holdOrderWhileBidding ? (
                  <div
                    onPointerDown={holdOrder}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") holdOrder();
                    }}
                  >
                    {bidControls(t)}
                  </div>
                ) : (
                  bidControls(t)
                ))}
            </div>
            <div className="min-w-[50px] shrink-0 text-right font-display text-[22px] leading-none tracking-[1px] text-neon">
              {t.credits}
              <span className="block font-sans text-[10px] font-normal tracking-normal text-muted">
                credits
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}