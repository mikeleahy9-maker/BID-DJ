"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { QrDisplay } from "@/components/ui/qr-display";
import { useToast } from "@/components/ui/use-toast";
import {
  DJEvent,
  EVENT_PALETTES,
  SAVED_PLAYLISTS,
  SONG_CATALOG,
  SeedSong,
} from "@/features/dj/data";
import {
  dbEventToGig,
  randomPin,
  type DbEventRow,
} from "@/features/dj/lib/dj-events";

interface EditForm {
  name: string;
  act: string;
  date: string;
  time: string;
  venue: string;
  pin: string;
  helperPin: string;
  palette: string;
}

function editFormFromRow(row: DbEventRow): EditForm {
  return {
    name: row.name,
    act: row.act ?? "",
    date: row.event_date ?? "",
    time: (row.event_time ?? "").slice(0, 5),
    venue: row.venue ?? "",
    pin: row.pin ?? "",
    helperPin: row.helper_pin ?? "",
    palette: row.palette ?? "noir",
  };
}

export default function EventSetupPanel({
  event: initialEvent,
  appUrl,
  dbRow,
}: {
  event: DJEvent;
  appUrl: string;
  dbRow: DbEventRow;
}) {
  const router = useRouter();
  const { show, toastNode } = useToast();
  const [ev, setEv] = useState<DJEvent>(initialEvent);
  const [seedList, setSeedList] = useState<SeedSong[]>(initialEvent.seedList);
  const [showQr, setShowQr] = useState(false);
  const [showSeed, setShowSeed] = useState(false);
  const [seedQuery, setSeedQuery] = useState("");
  const [seedBudget, setSeedBudget] = useState(5);

  const [showEdit, setShowEdit] = useState(false);
  const [row, setRow] = useState<DbEventRow>(dbRow);
  const [editForm, setEditForm] = useState<EditForm>(() => editFormFromRow(dbRow));
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);
  const [editLogoPreview, setEditLogoPreview] = useState<string | null>(
    dbRow.logo_url
  );
  const [editRemoveLogo, setEditRemoveLogo] = useState(false);
  const editLogoInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const filteredSongs = SONG_CATALOG.filter(
    (s) =>
      s.title.toLowerCase().includes(seedQuery.toLowerCase()) ||
      s.artist.toLowerCase().includes(seedQuery.toLowerCase())
  ).slice(0, 6);

  const seedSong = (song: SeedSong) => {
    setSeedList((prev) => {
      const exists = prev.find((x) => String(x.id) === String(song.id));
      if (exists) {
        return prev.map((x) =>
          String(x.id) === String(song.id)
            ? { ...x, credits: x.credits + seedBudget }
            : x
        );
      }
      return [...prev, { ...song, credits: seedBudget }];
    });
    setShowSeed(false);
    setSeedQuery("");
    setSeedBudget(5);
    show(`🎯 "${song.title}" seeded with 💎${seedBudget}!`);
  };

  const removeSeed = (id: string) => {
    setSeedList((prev) => prev.filter((s) => String(s.id) !== String(id)));
  };

  const loadPlaylist = (plId: string) => {
    const pl = SAVED_PLAYLISTS.find((p) => p.id === plId);
    if (!pl) return;
    setSeedList((prev) => {
      const merged = [...prev];
      pl.songs.forEach((s) => {
        if (!merged.find((x) => String(x.id) === String(s.id))) merged.push(s);
      });
      return merged;
    });
    show(`"${pl.name}" loaded into seed list!`);
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    show(`${label} copied: ${text}`);
  };

  const openEdit = () => {
    setEditForm(editFormFromRow(row));
    setEditLogoFile(null);
    setEditLogoPreview(row.logo_url);
    setEditRemoveLogo(false);
    setShowEdit(true);
  };

  const previewEditLogo = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === "string") setEditLogoPreview(e.target.result);
    };
    reader.readAsDataURL(file);
    setEditLogoFile(file);
    setEditRemoveLogo(false);
  };

  const saveEdit = async () => {
    if (!editForm.name.trim()) {
      show("Please enter an event/venue name");
      return;
    }
    if (!editForm.act.trim()) {
      show("Please enter your act name");
      return;
    }
    if (!editForm.pin.trim() || editForm.pin.length < 4) {
      show("Please enter a 4-digit guest PIN");
      return;
    }
    if (editForm.helperPin && editForm.helperPin.length < 6) {
      show("Helper PIN must be 6 digits");
      return;
    }
    if (editForm.helperPin && !/^\d{6}$/.test(editForm.helperPin)) {
      show("Helper PIN must be 6 digits");
      return;
    }
    if (editForm.pin === editForm.helperPin) {
      show("Guest PIN and Helper PIN must be different");
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("name", editForm.name.trim());
      fd.set("act", editForm.act.trim());
      fd.set("date", editForm.date);
      fd.set("time", editForm.time);
      fd.set("venue", editForm.venue.trim());
      fd.set("pin", editForm.pin);
      fd.set("helperPin", editForm.helperPin);
      fd.set("palette", editForm.palette);
      if (editLogoFile) fd.set("logo", editLogoFile);
      if (editRemoveLogo) fd.set("removeLogo", "1");

      const res = await fetch(`/api/dj/events/${row.id}`, {
        method: "PATCH",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.event) {
        show(data?.error ?? "Could not save changes. Please try again.");
        return;
      }

      const updated = dbEventToGig(data.event as DbEventRow);
      setRow(data.event as DbEventRow);
      setEv(updated);
      setEditForm(editFormFromRow(data.event as DbEventRow));
      setEditLogoFile(null);
      setEditLogoPreview((data.event as DbEventRow).logo_url);
      setEditRemoveLogo(false);
      setShowEdit(false);
      show(`"${updated.name}" updated ✔`);
    } catch {
      show("Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/dj/events/${row.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        show(data?.error ?? "Could not delete the event. Please try again.");
        return;
      }
      router.push("/dj/events");
    } catch {
      show("Could not reach the server. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-edge bg-surface-2 px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-neon";
  const labelCls = "text-[11px] uppercase tracking-[1px] text-muted";

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/dj/events"
        className="flex items-center gap-1 text-xs font-semibold text-muted transition hover:text-neon"
      >
        ← Back to Gigs
      </Link>

      <div className="rounded-xl border border-edge bg-surface p-5">
        {ev.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ev.logo}
            alt={`${ev.name} logo`}
            className="mb-4 h-24 w-24 rounded-xl object-cover"
          />
        )}
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 font-display text-2xl tracking-[2px]">{ev.name}</div>
            <div className="text-[12px] text-muted">
              {ev.date} · {ev.time} · {ev.act}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={openEdit}
              className="rounded-lg border border-neon px-3 py-1.5 text-[11px] font-bold text-neon transition hover:bg-neon/10"
            >
              ✏ Edit
            </button>
            <button
              onClick={() => setShowDelete(true)}
              className="rounded-lg border border-[#ff4466]/50 px-3 py-1.5 text-[11px] font-bold text-[#ff4466] transition hover:bg-[#ff4466]/10"
            >
              🗑 Delete
            </button>
          </div>
        </div>

        {/* Credentials card */}
        <div className="mb-5 rounded-xl border border-neon/20 bg-gradient-to-br from-neon/5 to-transparent p-4">
          <div className="mb-3 font-display text-base tracking-[1.5px] text-neon">
            🔐 Access Credentials
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Event Code", value: ev.code, copy: true },
              { label: "Guest PIN", value: ev.ownerPin, copy: true },
              { label: "Helper PIN", value: ev.helperPin, copy: true },
            ].map((c) => (
              <button
                key={c.label}
                onClick={() => copyText(c.value, c.label)}
                className="rounded-lg bg-surface-2 p-2.5 text-center transition hover:border hover:border-neon"
              >
                <div className="text-[10px] uppercase tracking-[1px] text-muted">{c.label}</div>
                <div className="mt-1 font-display text-xl tracking-[3px]">{c.value}</div>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted">
            Share the Helper PIN with staff managing the queue. They cannot end the event or
            view earnings.
          </p>
        </div>

        {/* QR card */}
        <div className="mb-5 rounded-xl border border-neon/20 bg-surface p-4 text-center">
          <div className="mb-3 flex items-center justify-between text-left">
            <div>
              <div className="font-display text-lg tracking-[1.5px]">Event QR Code</div>
              <div className="text-[11px] text-muted">Print or display at the venue</div>
            </div>
            <button
              onClick={() => setShowQr(true)}
              className="rounded-lg border border-neon px-3 py-1.5 text-[11px] font-bold text-neon transition hover:bg-neon/10"
            >
              ⬇ Full QR
            </button>
          </div>
          <div className="flex justify-center">
            <QrDisplay value={`${appUrl}/join/${ev.code}`} size={140} />
          </div>
          <div className="mt-2 font-display text-2xl tracking-[8px] text-neon">
            {ev.code}
          </div>
          <div className="mb-2 text-[11px] text-muted">
            Encodes: {appUrl}/join/{ev.code}
          </div>
          <button
            onClick={() => copyText(`${appUrl}/join/${ev.code}`, "Guest link")}
            className="w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-xs font-bold text-foreground transition hover:border-neon hover:text-neon"
          >
            📋 Copy Guest Link
          </button>
        </div>

        {/* Seed playlist */}
        <div className="mb-2 flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[2px] text-muted">🎯 Seed Playlist</div>
            <div className="text-[11px] text-muted">Songs pre-loaded with starter credits</div>
          </div>
          <button
            onClick={() => setShowSeed(true)}
            className="rounded-lg border border-neon-3 px-3 py-1.5 text-[11px] font-bold text-neon-3 transition hover:bg-neon-3/10"
          >
            + Add
          </button>
        </div>
        <div className="mb-2 flex flex-col gap-2">
          {seedList.length === 0 && (
            <p className="rounded-lg bg-surface-2 p-3 text-xs text-muted">
              No seed songs yet — add some to prime the queue
            </p>
          )}
          {seedList.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-lg border border-edge bg-surface-2 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">{s.title}</div>
                <div className="truncate text-[11px] text-muted">{s.artist}</div>
              </div>
              <div className="font-display text-lg text-neon-3">💎{s.credits}</div>
              <button
                onClick={() => removeSeed(s.id)}
                className="px-1 text-muted transition hover:text-neon-2"
                aria-label={`Remove ${s.title}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Saved playlists */}
        <div className="mb-4 text-[11px] uppercase tracking-[2px] text-muted">
          📂 Your Saved Playlists
        </div>
        <div className="mb-5 flex flex-col gap-2">
          {SAVED_PLAYLISTS.map((pl) => (
            <div
              key={pl.id}
              className="flex items-center gap-3 rounded-lg border border-edge bg-surface-2 px-3 py-2.5"
            >
              <span className="text-2xl" aria-hidden>{pl.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{pl.name}</div>
                <div className="text-[11px] text-muted">{pl.songs.length} songs</div>
              </div>
              <button
                onClick={() => loadPlaylist(pl.id)}
                className="rounded-lg border border-neon px-3 py-1.5 text-[11px] font-bold text-neon transition hover:bg-neon/10"
              >
                Load →
              </button>
            </div>
          ))}
        </div>

        <Link
          href="/dj/queue"
          className="block w-full rounded-xl bg-gradient-to-br from-neon to-[#00c9b1] px-4 py-3.5 text-center font-display text-lg tracking-[2px] text-bg shadow-[0_0_20px_rgba(0,255,225,0.2)] transition active:scale-[0.99]"
        >
          ▶ GO LIVE WITH THIS EVENT
        </Link>
      </div>

      {/* ---- Edit event modal ---- */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)}>
        <div className="mb-1 font-display text-2xl tracking-[2px]">✏ Edit Event</div>
        <p className="mb-4 text-xs text-muted">{ev.name} · Code {ev.code}</p>

        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-[5px]">
            <label className={labelCls}>Event / Venue Name</label>
            <input
              className={inputCls}
              placeholder="e.g. The Loft, Club Nova..."
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
          </div>
          <div className="flex gap-[10px]">
            <div className="flex flex-1 flex-col gap-[5px]">
              <label className={labelCls}>Date</label>
              <input
                type="date"
                className={inputCls}
                value={editForm.date}
                onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
              />
            </div>
            <div className="flex flex-1 flex-col gap-[5px]">
              <label className={labelCls}>Start Time</label>
              <input
                type="time"
                className={inputCls}
                value={editForm.time}
                onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-col gap-[5px]">
            <label className={labelCls}>Venue Address (optional)</label>
            <input
              className={inputCls}
              placeholder="e.g. 123 Main St, Chicago IL"
              value={editForm.venue}
              onChange={(e) => setEditForm({ ...editForm, venue: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-[5px]">
            <label className={labelCls}>Your Act Name</label>
            <input
              className={inputCls}
              placeholder="e.g. DJ Phantom, The Static Kings..."
              value={editForm.act}
              onChange={(e) => setEditForm({ ...editForm, act: e.target.value })}
            />
          </div>

          <div className="h-px bg-edge" aria-hidden />

          {/* Logo */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-[5px]">
              <label className={labelCls}>Event Logo / Image</label>
              <p className="text-[11px] text-muted">
                {editLogoFile
                  ? "New image ready to upload"
                  : editRemoveLogo
                    ? "Logo will be removed"
                    : "JPG, PNG · Recommended 400×400px"}
              </p>
            </div>
            {editLogoPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={editLogoPreview}
                alt="Event logo preview"
                className="h-16 w-16 rounded-lg object-cover"
              />
            )}
          </div>
          <div className="flex gap-2">
            <input
              ref={editLogoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => previewEditLogo(e.target.files?.[0])}
            />
            <button
              onClick={() => editLogoInputRef.current?.click()}
              className="flex-1 rounded-lg border border-edge bg-surface-2 px-3 py-2 text-xs font-bold text-foreground transition hover:border-neon hover:text-neon"
            >
              {editLogoFile ? "↺ Choose another" : "📁 Upload image"}
            </button>
            {(row.logo_url || editLogoPreview) && !editLogoFile && (
              <button
                onClick={() => {
                  setEditLogoPreview(null);
                  setEditRemoveLogo(true);
                }}
                className="rounded-lg border border-[#ff4466]/50 px-3 py-2 text-xs font-bold text-[#ff4466] transition hover:bg-[#ff4466]/10"
              >
                Remove
              </button>
            )}
          </div>

          <div className="h-px bg-edge" aria-hidden />

          {/* Palette */}
          <div className="flex flex-col gap-[5px]">
            <label className={labelCls}>Event Feel — Choose a Color Palette</label>
            <div className="grid grid-cols-4 gap-2">
              {EVENT_PALETTES.map((p) => {
                const selected = editForm.palette === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setEditForm({ ...editForm, palette: p.id })}
                    style={{ background: p.bg }}
                    className={`rounded-[10px] border-2 px-1.5 py-[10px] text-center transition-all active:scale-[0.97] ${
                      selected ? "scale-105 border-white" : "border-transparent hover:border-white/40"
                    }`}
                  >
                    <span
                      className="mx-auto mb-[5px] block h-7 w-7 rounded-full"
                      style={{ background: p.dot }}
                      aria-hidden
                    />
                    <span className="text-[10px] font-bold tracking-[0.5px] block" style={{ color: p.neon }}>
                      {p.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Credentials */}
          <div className="h-px bg-edge" aria-hidden />
          <div className="font-display text-base tracking-[1.5px] text-neon">
            🔐 Access Credentials
          </div>
          <div className="flex gap-[10px]">
            <div className="flex flex-1 flex-col gap-[5px]">
              <label className={labelCls}>Guest PIN (4 digits)</label>
              <div className="flex gap-1.5">
                <input
                  className={`${inputCls} font-display text-[20px] tracking-[4px]`}
                  placeholder="e.g. 7823"
                  inputMode="numeric"
                  maxLength={4}
                  value={editForm.pin}
                  onChange={(e) => setEditForm({ ...editForm, pin: e.target.value.replace(/\D/g, "") })}
                />
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, pin: randomPin(4, editForm.helperPin) })}
                  aria-label="Generate random guest PIN"
                  title="Generate random guest PIN"
                  className="shrink-0 rounded-lg border border-edge bg-surface-2 px-3 text-lg transition hover:border-neon"
                >
                  🎲
                </button>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-[5px]">
              <label className={labelCls}>Helper PIN (6 digits)</label>
              <div className="flex gap-1.5">
                <input
                  className={`${inputCls} font-display text-[20px] tracking-[4px]`}
                  placeholder="e.g. 441102"
                  inputMode="numeric"
                  maxLength={6}
                  value={editForm.helperPin}
                  onChange={(e) => setEditForm({ ...editForm, helperPin: e.target.value.replace(/\D/g, "") })}
                />
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, helperPin: randomPin(6, editForm.pin) })}
                  aria-label="Generate random helper PIN"
                  title="Generate random helper PIN"
                  className="shrink-0 rounded-lg border border-edge bg-surface-2 px-3 text-lg transition hover:border-neon"
                >
                  🎲
                </button>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted">
            Guest PIN is shared with attendees. Helper PIN gives staff queue access without
            financials.
          </p>
        </div>

        <button
          onClick={saveEdit}
          disabled={saving}
          className="w-full rounded-[10px] bg-neon-2 px-4 py-[15px] text-[15px] font-bold tracking-[1px] text-white transition hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "SAVING…" : "SAVE CHANGES →"}
        </button>
      </Modal>

      {/* ---- Delete event modal ---- */}
      <Modal open={showDelete} onClose={() => setShowDelete(false)}>
        <div className="mb-1 font-display text-2xl tracking-[2px] text-[#ff4466]">
          🗑 Delete Event
        </div>
        <p className="mb-2 text-sm text-foreground">
          Permanently delete <b>{ev.name}</b>?
        </p>
        <p className="mb-5 text-xs leading-[1.7] text-muted">
          This removes the event, its QR code, and any linked data. This action
          cannot be undone.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDelete(false)}
            className="flex-1 rounded-[10px] border border-edge bg-surface-2 px-4 py-3 text-sm font-bold text-foreground transition hover:border-neon hover:text-neon"
          >
            Cancel
          </button>
          <button
            onClick={confirmDelete}
            disabled={deleting}
            className="flex-1 rounded-[10px] bg-[#ff4466] px-4 py-3 text-sm font-bold tracking-[1px] text-white transition hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? "DELETING…" : "🗑 DELETE EVENT"}
          </button>
        </div>
      </Modal>

      {/* ---- Seed song modal ---- */}
      <Modal open={showSeed} onClose={() => setShowSeed(false)}>
        <div className="mb-1 font-display text-2xl tracking-[2px]">🎯 Seed a Song</div>
        <p className="mb-4 text-xs text-muted">Pre-load a song with starter credits</p>
        <input
          className={inputCls}
          placeholder="Search songs to seed..."
          value={seedQuery}
          onChange={(e) => setSeedQuery(e.target.value)}
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
          {filteredSongs.map((s) => (
            <button
              key={s.id}
              onClick={() => seedSong(s)}
              className="flex items-center justify-between rounded-lg px-2 py-2.5 text-left transition hover:bg-surface-2"
            >
              <span>
                <span className="block text-sm font-semibold">{s.title}</span>
                <span className="block text-[11px] text-muted">{s.artist}</span>
              </span>
              <span className="text-[11px] font-bold text-neon-3">+ 💎{seedBudget}</span>
            </button>
          ))}
          {filteredSongs.length === 0 && (
            <p className="py-3 text-center text-xs text-muted">No matching songs</p>
          )}
        </div>
      </Modal>

      {/* ---- Full QR modal ---- */}
      <Modal open={showQr} onClose={() => setShowQr(false)}>
        <div className="text-center">
          <div className="mb-1 font-display text-2xl tracking-[2px]">Event QR Code</div>
          <p className="mb-4 text-xs text-muted">Print or display at the venue</p>
          <div className="flex justify-center">
            <QrDisplay value={`${appUrl}/join/${ev.code}`} size={200} />
          </div>
          <div className="mt-3 font-display text-3xl tracking-[8px] text-neon">
            {ev.code}
          </div>
          <button
            onClick={() => copyText(`${appUrl}/join/${ev.code}`, "Guest link")}
            className="mt-4 w-full rounded-lg border border-edge bg-surface-2 px-3 py-2.5 text-xs font-bold text-foreground transition hover:border-neon hover:text-neon"
          >
            📋 Copy Guest Link
          </button>
        </div>
      </Modal>

      {toastNode}
    </div>
  );
}