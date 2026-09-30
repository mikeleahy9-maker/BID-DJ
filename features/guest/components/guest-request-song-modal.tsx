"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useInfiniteSongSearch } from "@/features/dj/lib/use-infinite-song-search";
import { InfiniteScrollLoader } from "@/features/dj/components/infinite-scroll-loader";
import type { SeedSong } from "@/features/dj/data";

type SearchMode = "song" | "artist" | "freeform";

const BLOCKED_WORDS = ["fuck", "shit", "bitch", "ass", "cunt", "nigger", "faggot"];

export interface SongPick {
  title: string;
  artist: string;
  deezerId?: number | null;
  coverUrl?: string | null;
}

export function GuestRequestSongModal({
  open,
  onClose,
  credits,
  onRequest,
  onNotEnoughCredits,
}: {
  open: boolean;
  onClose: () => void;
  credits: number;
  onRequest: (song: SongPick) => Promise<boolean>;
  onNotEnoughCredits: () => void;
}) {
  const [mode, setMode] = useState<SearchMode>("song");
  const [submitting, setSubmitting] = useState(false);
  const [freeTitle, setFreeTitle] = useState("");
  const [freeArtist, setFreeArtist] = useState("");
  const { query, results, searching, loadingMore, hasMore, handleSearch, loadMore, reset: resetSearch } =
    useInfiniteSongSearch();

  const reset = () => {
    setMode("song");
    resetSearch();
    setFreeTitle("");
    setFreeArtist("");
  };

  const submitCatalog = async (s: SeedSong) => {
    if (submitting) return;
    if (credits < 2) {
      onClose();
      onNotEnoughCredits();
      return;
    }
    setSubmitting(true);
    const ok = await onRequest({
      title: s.title,
      artist: s.artist,
      deezerId: s.deezerId ?? null,
      coverUrl: s.image ?? null,
    });
    setSubmitting(false);
    if (ok) {
      onClose();
      reset();
    }
  };

  const submitFreeform = async () => {
    if (submitting) return;
    const title = freeTitle.trim();
    if (!title) {
      onClose();
      return;
    }
    const combined = `${title} ${freeArtist}`.toLowerCase();
    if (BLOCKED_WORDS.some((w) => combined.includes(w))) {
      onClose();
      return;
    }
    if (credits < 2) {
      onClose();
      onNotEnoughCredits();
      return;
    }
    setSubmitting(true);
    const ok = await onRequest({
      title,
      artist: freeArtist || "Unknown Artist",
      deezerId: null,
      coverUrl: null,
    });
    setSubmitting(false);
    if (ok) {
      onClose();
      reset();
    }
  };

  return (
    <Modal open={open} onClose={onClose} sheet>
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-5 top-4 cursor-pointer border-none bg-transparent text-xl text-muted"
      >
        ✕
      </button>
      <div className="font-display text-[28px] tracking-[2px]">
        Request a Song
      </div>
      <div className="mb-4 mt-1 text-xs text-muted">
        Search any song — costs 2 credits and the DJ approves it first
      </div>

      {/* tabs */}
      <div className="mb-3.5 flex gap-1.5">
        {(
          [
            { id: "song", label: "🎵 By Title" },
            { id: "artist", label: "🎤 By Artist" },
            { id: "freeform", label: "✏️ Can't Find It" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            disabled={submitting}
            className={`flex-1 cursor-pointer rounded-lg border px-2 py-2 text-xs font-semibold transition-all ${
              mode === t.id
                ? "border-neon bg-neon/5 text-neon"
                : "border-edge bg-surface-2 text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode !== "freeform" ? (
        <div>
          <div className="relative mb-3">
            <span
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base"
              aria-hidden
            >
              🔍
            </span>
            <input
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={
                mode === "artist"
                  ? "e.g. Deee-Lite, Madonna, Drake..."
                  : "e.g. Groove Is in the Heart..."
              }
              autoFocus
              className="w-full rounded-[10px] border border-edge bg-surface-2 py-3 pl-11 pr-4 text-sm text-foreground outline-none transition focus:border-neon placeholder:text-muted"
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {query.trim().length < 2 && (
              <div className="py-5 text-center text-[13px] text-muted">
                Search for any song to request
              </div>
            )}
            {searching && (
              <div className="py-5 text-center text-[13px] text-muted">
                Searching…
              </div>
            )}
            {!searching &&
              query.trim().length >= 2 &&
              results.length === 0 && (
                <div className="py-5 text-center text-[13px] text-muted">
                  No matching songs
                  <br />
                  <span className="text-[11px]">
                    Try a different title or artist
                  </span>
                </div>
              )}
            {results.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border-b border-edge px-3.5 py-3 transition-colors active:bg-surface-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {s.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.image}
                      alt={s.title}
                      className="h-9 w-9 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-2 text-lg">
                      🎵
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{s.title}</div>
                    <div className="mt-0.5 text-[11px] text-muted">
                      {s.artist}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => submitCatalog(s)}
                  disabled={submitting}
                  className="ml-2 shrink-0 cursor-pointer rounded-md border border-neon px-3 py-1.5 text-[11px] font-bold text-neon transition active:bg-neon/10 disabled:opacity-50"
                >
                  +ADD
                </button>
              </div>
            ))}
            <InfiniteScrollLoader
              onLoadMore={loadMore}
              loading={loadingMore}
              hasMore={hasMore}
            />
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-3 rounded-lg bg-surface-2 px-3 py-2.5 text-xs leading-[1.5] text-muted">
            Can&apos;t find your song? Type it in below. The DJ/Band will review it
            before it appears on the queue.
          </div>
          <div className="mb-2.5">
            <label className="mb-1 block text-[11px] text-muted">
              Song Title
            </label>
            <input
              value={freeTitle}
              onChange={(e) => setFreeTitle(e.target.value)}
              placeholder="e.g. Groove Is in the Heart"
              maxLength={80}
              className="w-full rounded-lg border border-edge bg-surface-2 px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-neon placeholder:text-muted"
            />
          </div>
          <div className="mb-4">
            <label className="mb-1 block text-[11px] text-muted">
              Artist
            </label>
            <input
              value={freeArtist}
              onChange={(e) => setFreeArtist(e.target.value)}
              placeholder="e.g. Deee-Lite"
              maxLength={80}
              className="w-full rounded-lg border border-edge bg-surface-2 px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-neon placeholder:text-muted"
            />
          </div>
          <div className="mb-3.5 rounded-lg border border-neon-3/20 bg-neon-3/5 px-3 py-2.5 text-[11px] leading-[1.5] text-neon-3">
            ⚠️ Requests are reviewed by the DJ/Band before going live.
            Offensive or inappropriate requests will be declined and credits
            refunded.
          </div>
          <button
            onClick={submitFreeform}
            disabled={submitting}
            className="w-full cursor-pointer rounded-[10px] border-none bg-neon-2 px-4 py-3.5 text-[15px] font-bold tracking-[1px] text-white disabled:opacity-50"
          >
            {submitting ? "SENDING…" : "SUBMIT FOR REVIEW — 2 💎"}
          </button>
        </div>
      )}
    </Modal>
  );
}