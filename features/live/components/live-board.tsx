"use client";

import React from "react";
import type { LiveTrack } from "../lib/use-live-queue";

interface LiveBoardProps {
  tracks: LiveTrack[];
  variant?: "dj" | "guest";
  actions?: (track: LiveTrack) => React.ReactNode;
  /** Guest-only: the +1 / +5 / -1 / -3 bid ladder under each queued song. */
  bidControls?: (track: LiveTrack) => React.ReactNode;
  emptyText?: string;
}

const RANK_BARS = ["#ffe600", "#aaa", "#cd7f32"];

export function LiveBoard({
  tracks,
  variant = "guest",
  actions,
  bidControls,
  emptyText = "No songs on the board yet",
}: LiveBoardProps) {
  const now = tracks.find((t) => t.status === "playing");
  const queued = tracks
    .filter((t) => t.status === "queued")
    .sort((a, b) => b.credits - a.credits);
  const list = now ? [now, ...queued] : queued;

  if (list.length === 0) {
    return <p className="p-4 text-center text-xs text-muted">{emptyText}</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {list.map((t, i) => {
        const isTop = i === 0;
        const bar = isTop ? "#ffe600" : RANK_BARS[i] ?? "#2a2a2a";

        if (variant === "dj") {
          return (
            <div
              key={t.id}
              className="relative flex flex-col gap-3 overflow-hidden rounded-xl border border-edge bg-surface p-3.5 sm:flex-row sm:items-center"
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
            className={`flex items-start gap-3 overflow-hidden rounded-xl border bg-surface p-3.5 ${
              isTop ? "border-neon-3/25" : "border-edge"
            }`}
          >
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
              {bidControls?.(t)}
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