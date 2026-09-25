"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/use-toast";
import { searchDeezerSongs } from "@/features/dj/lib/deezer";
import type { SavedPlaylist, SeedSong } from "@/features/dj/data";

const ICON_CHOICES = ["🎵", "🔥", "🌊", "🎉", "🪩", "⚡", "💿", "🎧"];

function isSameSong(a: SeedSong, b: SeedSong): boolean {
  return String(a.id) === String(b.id);
}

export default function PlaylistsManager({
  initialPlaylists,
}: {
  initialPlaylists: SavedPlaylist[];
}) {
  const { show, toastNode } = useToast();
  const [playlists, setPlaylists] = useState<SavedPlaylist[]>(initialPlaylists);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create / edit modal
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SavedPlaylist | null>(null);
  const [formName, setFormName] = useState("");
  const [formIcon, setFormIcon] = useState("🎵");
  const [saving, setSaving] = useState(false);

  // Delete confirm (two-step inline)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Add-songs modal + Deezer search
  const [addingTo, setAddingTo] = useState<SavedPlaylist | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SeedSong[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [creditDrafts, setCreditDrafts] = useState<Record<string, string>>({});
  const saveTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const trackKey = (song: SeedSong) => String(song.deezerId ?? song.id);

  useEffect(() => {
    const timers = saveTimerRef.current;
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      Object.values(timers).forEach((t) => clearTimeout(t));
    };
  }, []);

  const inputCls =
    "w-full rounded-lg border border-edge bg-surface-2 px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-neon";
  const labelCls = "text-[11px] uppercase tracking-[1px] text-muted";

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setFormIcon("🎵");
    setShowForm(true);
  };

  const openEdit = (pl: SavedPlaylist) => {
    setEditing(pl);
    setFormName(pl.name);
    setFormIcon(pl.icon);
    setShowForm(true);
  };

  const savePlaylist = async () => {
    const name = formName.trim();
    if (!name) {
      show("Please enter a playlist name");
      return;
    }
    setSaving(true);
    try {
      const isEdit = !!editing;
      const res = await fetch(
        isEdit ? `/api/dj/playlists/${editing.id}` : "/api/dj/playlists",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, icon: formIcon }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save the playlist");

      if (isEdit) {
        setPlaylists((prev) =>
          prev.map((p) =>
            p.id === editing.id ? { ...p, name, icon: formIcon } : p
          )
        );
        show(`"${name}" updated`);
      } else {
        setPlaylists((prev) => [
          {
            id: data.playlist.id as string,
            name: data.playlist.name as string,
            icon: data.playlist.icon as string,
            songs: [],
          },
          ...prev,
        ]);
        show(`"${name}" created`);
      }
      setShowForm(false);
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not save the playlist");
    } finally {
      setSaving(false);
    }
  };

  const deletePlaylist = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/dj/playlists/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not delete the playlist");
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
      if (expandedId === id) setExpandedId(null);
      if (addingTo?.id === id) setAddingTo(null);
      show("Playlist deleted");
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not delete the playlist");
    } finally {
      setDeletingId(null);
      setDeleteConfirmId(null);
    }
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    const q = value.trim();
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      const results = await searchDeezerSongs(q);
      setSearchResults(results);
      setSearching(false);
    }, 700);
  };

  const addSong = async (song: SeedSong) => {
    if (!addingTo) return;
    setAddingId(song.id);
    try {
      const res = await fetch(`/api/dj/playlists/${addingTo.id}/tracks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deezerId: song.deezerId ?? null,
          title: song.title,
          artist: song.artist,
          image: song.image ?? null,
          durationSec: song.durationSec ?? null,
          credits: song.credits || 5,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not add the song");
      if (!data.already) {
        setPlaylists((prev) =>
          prev.map((p) =>
            p.id === addingTo.id && !p.songs.some((x) => isSameSong(x, song))
              ? { ...p, songs: [...p.songs, { ...song, credits: song.credits || 5 }] }
              : p
          )
        );
        show(`"${song.title}" added to ${addingTo.name}`);
      } else {
        show(`"${song.title}" is already in ${addingTo.name}`);
      }
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not add the song");
    } finally {
      setAddingId(null);
    }
  };

  const scheduleCreditsSave = (
    playlistId: string,
    key: string,
    credits: number,
    title: string
  ) => {
    if (saveTimerRef.current[key]) clearTimeout(saveTimerRef.current[key]);
    saveTimerRef.current[key] = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/dj/playlists/${playlistId}/tracks?deezerId=${encodeURIComponent(key)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credits }),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not update credits");
        show(`💎 ${credits} credits for "${title}"`);
      } catch (err) {
        show(err instanceof Error ? err.message : "Could not update credits");
      } finally {
        delete saveTimerRef.current[key];
      }
    }, 600);
  };

  const setCreditValue = (
    pl: SavedPlaylist,
    song: SeedSong,
    key: string,
    next: number,
    clearDraft: boolean
  ) => {
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === pl.id
          ? {
              ...p,
              songs: p.songs.map((x) =>
                trackKey(x) === key ? { ...x, credits: next } : x
              ),
            }
          : p
      )
    );
    if (clearDraft) {
      setCreditDrafts((prev) => {
        const c = { ...prev };
        delete c[key];
        return c;
      });
    }
    scheduleCreditsSave(pl.id, key, next, song.title);
  };

  const bumpCredits = (pl: SavedPlaylist, song: SeedSong, delta: number) => {
    const key = trackKey(song);
    const current =
      playlists
        .find((p) => p.id === pl.id)
        ?.songs.find((x) => trackKey(x) === key)?.credits ?? 0;
    setCreditValue(
      pl,
      song,
      key,
      Math.max(0, Math.min(1000, current + delta)),
      true
    );
  };

  const onCreditInput = (pl: SavedPlaylist, song: SeedSong, raw: string) => {
    const key = trackKey(song);
    setCreditDrafts((prev) => ({ ...prev, [key]: raw }));
    if (raw.trim() === "") return;
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n < 0) return;
    setCreditValue(pl, song, key, Math.min(1000, n), false);
  };

  const commitCreditInput = (pl: SavedPlaylist, song: SeedSong) => {
    const key = trackKey(song);
    const raw = creditDrafts[key];
    setCreditDrafts((prev) => {
      const c = { ...prev };
      delete c[key];
      return c;
    });
    if (raw === undefined || raw.trim() === "") return;
    const n = Math.floor(Number(raw));
    setCreditValue(
      pl,
      song,
      key,
      Number.isFinite(n) && n >= 0 ? Math.min(1000, n) : 0,
      false
    );
  };

  const removeSong = async (pl: SavedPlaylist, song: SeedSong) => {
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === pl.id
          ? { ...p, songs: p.songs.filter((x) => !isSameSong(x, song)) }
          : p
      )
    );
    try {
      const res = await fetch(
        `/api/dj/playlists/${pl.id}/tracks?deezerId=${encodeURIComponent(song.deezerId ?? song.id)}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not remove the song");
      show(`"${song.title}" removed`);
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not remove the song");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl tracking-[2px]">Your Playlists</h1>
          <p className="mt-1 text-[12px] text-muted">
            {playlists.length}{" "}
            {playlists.length === 1 ? "playlist" : "playlists"} · load them into
            any event&apos;s seed list
          </p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg border border-neon px-4 py-2 text-[11px] font-bold text-neon transition hover:bg-neon/10"
        >
          + New Playlist
        </button>
      </div>

      {playlists.length === 0 && (
        <p className="rounded-xl border border-dashed border-edge bg-surface/60 p-8 text-center text-sm text-muted">
          No playlists yet — hit &quot;+ New Playlist&quot; to build your first
          one, then add songs from Deezer.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {playlists.map((pl) => (
          <div
            key={pl.id}
            className="rounded-xl border border-edge bg-surface p-4 transition-colors"
          >
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  setExpandedId((prev) => (prev === pl.id ? null : pl.id))
                }
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span
                  aria-hidden
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-edge bg-surface-2 text-2xl"
                >
                  {pl.icon}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-display text-base tracking-[1px]">
                    {pl.name}
                  </span>
                  <span className="block text-[11px] text-muted">
                    {pl.songs.length} {pl.songs.length === 1 ? "song" : "songs"}
                  </span>
                </span>
              </button>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  aria-label={`Edit ${pl.name}`}
                  onClick={() => openEdit(pl)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-edge bg-surface-2 text-muted transition hover:border-neon hover:text-neon"
                >
                  <PencilIcon className="h-3.5 w-3.5" />
                </button>
                {deleteConfirmId === pl.id ? (
                  <button
                    onClick={() => deletePlaylist(pl.id)}
                    disabled={deletingId === pl.id}
                    className="flex h-8 items-center justify-center rounded-lg border border-neon-2 bg-neon-2/10 px-2.5 text-[11px] font-bold text-neon-2 transition disabled:opacity-60"
                  >
                    Sure?
                  </button>
                ) : (
                  <button
                    aria-label={`Delete ${pl.name}`}
                    onClick={() => setDeleteConfirmId(pl.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-edge bg-surface-2 text-muted transition hover:border-neon-2 hover:text-neon-2"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {expandedId === pl.id && (
              <div className="mt-3 flex flex-col gap-2 border-t border-edge pt-3">
                {pl.songs.length === 0 && (
                  <p className="text-[11px] text-muted">
                    No songs yet — add some below.
                  </p>
                )}
                {pl.songs.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2"
                  >
                    {s.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.image}
                        alt={s.title}
                        className="h-8 w-8 rounded object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="flex h-8 w-8 items-center justify-center rounded bg-surface text-lg"
                      >
                        🎵
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        {s.title}
                      </div>
                      <div className="truncate text-[11px] text-muted">
                        {s.artist}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center rounded-lg border border-edge bg-surface p-0.5">
                      <button
                        aria-label={`Reduce credits for ${s.title}`}
                        onClick={() => bumpCredits(pl, s, -1)}
                        className="flex h-6 w-6 items-center justify-center rounded text-sm text-muted transition hover:text-neon-3"
                      >
                        −
                      </button>
                      <span aria-hidden className="px-0.5 text-[10px]">
                        💎
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        aria-label={`Credits for ${s.title}`}
                        value={creditDrafts[trackKey(s)] ?? String(s.credits)}
                        onChange={(e) => onCreditInput(pl, s, e.target.value)}
                        onBlur={() => commitCreditInput(pl, s)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                        className="w-[42px] bg-transparent text-center text-[12px] font-bold text-neon-3 outline-none"
                      />
                      <button
                        aria-label={`Increase credits for ${s.title}`}
                        onClick={() => bumpCredits(pl, s, 1)}
                        className="flex h-6 w-6 items-center justify-center rounded text-sm text-muted transition hover:text-neon-3"
                      >
                        +
                      </button>
                    </div>
                    <button
                      aria-label={`Remove ${s.title}`}
                      onClick={() => removeSong(pl, s)}
                      className="px-1 text-muted transition hover:text-neon-2"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    setAddingTo(pl);
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                  className="self-start rounded-lg border border-neon px-3 py-1.5 text-[11px] font-bold text-neon transition hover:bg-neon/10"
                >
                  ➕ Add songs
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ---- Create / edit playlist modal ---- */}
      <Modal open={showForm} onClose={() => setShowForm(false)} sheet>
        <button
          aria-label="Close"
          onClick={() => setShowForm(false)}
          className="absolute right-5 top-4 text-xl text-muted transition-colors hover:text-foreground"
        >
          ✕
        </button>
        <div className="mb-1.5 font-display text-[30px] tracking-[2px]">
          {editing ? "Edit Playlist" : "New Playlist"}
        </div>
        <p className="mb-[22px] text-xs text-muted">
          {editing
            ? "Rename it or pick a new vibe."
            : "A collection of songs you can load into any event's seed list."}
        </p>

        <div className="mb-4 flex flex-col gap-[5px]">
          <label className={labelCls}>Name</label>
          <input
            className={inputCls}
            placeholder="e.g. Club Bangers"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="mb-[18px] flex flex-col gap-[5px]">
          <label className={labelCls}>Icon</label>
          <div className="flex flex-wrap gap-2">
            {ICON_CHOICES.map((ic) => (
              <button
                key={ic}
                onClick={() => setFormIcon(ic)}
                className={`flex h-10 w-10 items-center justify-center rounded-lg border text-xl transition ${
                  formIcon === ic
                    ? "border-neon bg-neon/10"
                    : "border-edge bg-surface-2 hover:border-neon/60"
                }`}
                aria-label={`Icon ${ic}`}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={savePlaylist}
          disabled={saving || !formName.trim()}
          className="w-full rounded-xl bg-gradient-to-br from-neon to-[#00c9b1] px-4 py-3.5 text-center font-display text-lg tracking-[2px] text-bg transition active:scale-[0.99] disabled:opacity-60"
        >
          {saving
            ? "Saving…"
            : editing
              ? "Save Changes"
              : "Create Playlist"}
        </button>
      </Modal>

      {/* ---- Add songs modal ---- */}
      <Modal open={!!addingTo} onClose={() => setAddingTo(null)} sheet>
        <button
          aria-label="Close"
          onClick={() => setAddingTo(null)}
          className="absolute right-5 top-4 text-xl text-muted transition-colors hover:text-foreground"
        >
          ✕
        </button>
        <div className="mb-1.5 font-display text-[30px] tracking-[2px]">
          Add Songs
        </div>
        <p className="mb-[22px] text-xs text-muted">
          {addingTo
            ? `Search Deezer to add tracks to "${addingTo.name}".`
            : "Search Deezer for songs."}
        </p>

        <input
          className={inputCls}
          placeholder="Search Deezer for songs..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          autoFocus
        />

        <div className="mt-4 flex max-h-80 flex-col gap-2 overflow-y-auto">
          {searchQuery.trim().length < 2 ? (
            <p className="py-8 text-center text-sm text-muted">
              Start typing to search for songs…
            </p>
          ) : searching ? (
            <p className="py-8 text-center text-sm text-muted">Searching…</p>
          ) : searchResults.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              No results found.
            </p>
          ) : (
            searchResults.map((s) => {
              const already = addingTo?.songs.some((x) => isSameSong(x, s)) ?? false;
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-lg border border-edge bg-surface-2 px-3 py-2"
                >
                  {s.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.image}
                      alt={s.title}
                      className="h-9 w-9 rounded object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="flex h-9 w-9 items-center justify-center rounded bg-surface text-lg"
                    >
                      🎵
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {s.title}
                    </div>
                    <div className="truncate text-[11px] text-muted">
                      {s.artist}
                    </div>
                  </div>
                  <button
                    disabled={already || addingId === s.id}
                    onClick={() => addSong(s)}
                    className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold transition disabled:opacity-60 ${
                      already
                        ? "border-neon-3/50 text-neon-3"
                        : "border-neon text-neon hover:bg-neon/10"
                    }`}
                  >
                    {already ? "✓ Added" : addingId === s.id ? "Adding…" : "+ Add"}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <button
          onClick={() => setAddingTo(null)}
          className="mt-5 w-full rounded-xl border border-edge px-4 py-3 text-center text-sm font-bold text-muted transition hover:text-foreground"
        >
          Done
        </button>
      </Modal>

      {toastNode}
    </div>
  );
}

function PencilIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z" />
    </svg>
  );
}

function TrashIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}