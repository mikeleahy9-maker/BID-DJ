"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/modal";
import { QrDisplay } from "@/components/ui/qr-display";
import { useToast } from "@/components/ui/use-toast";
import {
  DJ_EVENTS,
  PAST_EVENTS,
  DJ_OWNER,
  SAVED_PLAYLISTS,
  SONG_CATALOG,
  EVENT_PALETTES,
  SeedSong,
  DJEvent,
} from "@/features/dj/data";

/**
 * Events & Setup page — the prototype's "Gigs" and "Setup" tabs merged
 * into a web-friendly master–detail layout.
 */

type Mode = "list" | "setup";

export default function EventsManager() {
  const { show, toastNode } = useToast();
  const [events, setEvents] = useState<DJEvent[]>(DJ_EVENTS);
  const [mode, setMode] = useState<Mode>("list");
  const [activeId, setActiveId] = useState(DJ_EVENTS[0].id);
  const [showCreate, setShowCreate] = useState(false);
  const [showSeed, setShowSeed] = useState(false);
  const [showQr, setShowQr] = useState(false);

  // Create-event form state
  const [form, setForm] = useState({
    name: "",
    act: "",
    date: "",
    time: "21:00",
    venue: "",
    pin: "",
    helperPin: "",
    palette: "noir",
  });
  const [logo, setLogo] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Seed song search state
  const [seedQuery, setSeedQuery] = useState("");
  const [seedBudget, setSeedBudget] = useState(5);

  const activeEvent = events.find((e) => e.id === activeId) ?? events[0];

  const openSetup = (id: string) => {
    setActiveId(id);
    setMode("setup");
  };

  const handleCreate = () => {
    if (!form.name.trim()) {
      show("Please enter an event/venue name");
      return;
    }
    if (!form.act.trim()) {
      show("Please enter your act name");
      return;
    }
    if (!form.pin.trim() || form.pin.length < 4) {
      show("Please enter a 4-digit guest PIN");
      return;
    }
    if (form.helperPin && form.helperPin.length < 4) {
      show("Helper PIN must be 4 digits");
      return;
    }
    if (form.pin === form.helperPin) {
      show("Guest PIN and Helper PIN must be different");
      return;
    }
    // Demo code — production generates via DB + unique code service
    const code = `BB${String(events.length + 1).padStart(4, "0")}`;
    const newEvent: DJEvent = {
      id: `ev${Date.now()}`,
      name: form.name.trim(),
      act: form.act.trim(),
      date: form.date || "TBD",
      time: form.time || "TBD",
      venue: form.venue.trim() || undefined,
      palette: form.palette,
      logo: logo ?? undefined,
      code,
      ownerPin: form.pin,
      helperPin: form.helperPin || "",
      seedList: [],
    };
    setEvents((prev) => [newEvent, ...prev]);
    setShowCreate(false);
    setForm({ name: "", act: "", date: "", time: "21:00", venue: "", pin: "", helperPin: "", palette: "noir" });
    setLogo(null);
    show(`"${newEvent.name}" created! Code: ${code} 🎉`);
  };

  const previewLogo = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === "string") setLogo(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const filteredSongs = SONG_CATALOG.filter(
    (s) =>
      s.title.toLowerCase().includes(seedQuery.toLowerCase()) ||
      s.artist.toLowerCase().includes(seedQuery.toLowerCase())
  ).slice(0, 6);

  const seedSong = (song: SeedSong) => {
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id !== activeId) return ev;
        const exists = ev.seedList.find((x) => String(x.id) === String(song.id));
        if (exists) {
          return {
            ...ev,
            seedList: ev.seedList.map((x) =>
              String(x.id) === String(song.id)
                ? { ...x, credits: x.credits + seedBudget }
                : x
            ),
          };
        }
        return {
          ...ev,
          seedList: [...ev.seedList, { ...song, credits: seedBudget }],
        };
      })
    );
    setShowSeed(false);
    setSeedQuery("");
    setSeedBudget(5);
    show(`🎯 "${song.title}" seeded with 💎${seedBudget}!`);
  };

  const removeSeed = (id: string) => {
    setEvents((prev) =>
      prev.map((ev) =>
        ev.id === activeId
          ? { ...ev, seedList: ev.seedList.filter((s) => String(s.id) !== String(id)) }
          : ev
      )
    );
  };

  const loadPlaylist = (plId: string) => {
    const pl = SAVED_PLAYLISTS.find((p) => p.id === plId);
    if (!pl) return;
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id !== activeId) return ev;
        const merged = [...ev.seedList];
        pl.songs.forEach((s) => {
          if (!merged.find((x) => String(x.id) === String(s.id))) merged.push(s);
        });
        return { ...ev, seedList: merged };
      })
    );
    show(`"${pl.name}" loaded into seed list!`);
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    show(`${label} copied: ${text}`);
  };

  const inputCls =
    "w-full rounded-lg border border-edge bg-surface-2 px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-neon";
  const labelCls = "text-[11px] uppercase tracking-[1px] text-muted";

  return (
    <div className="flex flex-col gap-6">
      {/* Owner profile strip */}
      <section
        className={`items-center gap-4 rounded-xl border border-edge bg-surface p-4 ${
          mode === "setup" ? "hidden lg:flex lg:flex-wrap" : "flex flex-wrap"
        }`}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-2xl">
          {DJ_OWNER.avatar}
        </div>
        <div>
          <div className="font-display text-xl tracking-[1.5px]">{DJ_OWNER.name}</div>
          <div className="text-[11px] text-neon">{DJ_OWNER.handle}</div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="ml-auto rounded-lg border border-neon px-4 py-2 text-xs font-bold text-neon transition hover:bg-neon/10"
        >
          + New Event
        </button>
      </section>

      {/* Master–detail: list | setup on desktop */}
      <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-start">
        {/* Left: gigs list */}
        <div className={`flex-col gap-4 ${mode === "setup" ? "hidden lg:flex" : "flex"}`}>
          <div>
            <h2 className="mb-3 text-[11px] uppercase tracking-[2px] text-muted">Upcoming Gigs</h2>
            <div className="flex flex-col gap-2.5">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className={`rounded-xl border bg-surface p-4 transition-colors ${
                    activeId === ev.id && mode === "setup"
                      ? "border-neon"
                      : "border-edge"
                  }`}
                >
                  <div className="font-display text-xl tracking-[1.5px]">{ev.name}</div>
                  <div className="mt-1 text-[11px] text-muted">
                    {ev.date} · {ev.time} · Code:{" "}
                    <span className="font-semibold text-neon">{ev.code}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => openSetup(ev.id)}
                      className="flex-1 rounded-lg border border-edge bg-surface-2 px-3 py-2 text-[11px] font-bold text-foreground transition hover:border-neon hover:text-neon"
                    >
                      ⚙ Setup & QR
                    </button>
                    <Link
                      href="/dj/queue"
                      className="flex-1 rounded-lg border border-neon-2 px-3 py-2 text-center text-[11px] font-bold text-neon-2 transition hover:bg-neon-2/10"
                    >
                      ▶ Go Live
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-[11px] uppercase tracking-[2px] text-muted">Recent Gigs</h2>
            <div className="overflow-hidden rounded-xl border border-edge bg-surface">
              {PAST_EVENTS.map((ev) => (
                <div
                  key={ev.name}
                  className="flex items-center gap-3 border-b border-edge px-4 py-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{ev.name}</div>
                    <div className="text-[11px] text-muted">{ev.date} · {ev.songs} songs</div>
                  </div>
                  <div className="font-display text-lg text-neon">${ev.earned.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: setup panel */}
        <div className={`rounded-xl border border-edge bg-surface p-5 ${mode === "list" ? "hidden lg:block" : ""}`}>
          <button
            onClick={() => setMode("list")}
            className="mb-3 flex items-center gap-1 text-xs font-semibold text-muted transition hover:text-neon lg:hidden"
          >
            ← Back to Gigs
          </button>
          <div className="mb-1 font-display text-2xl tracking-[2px]">{activeEvent.name}</div>
          <div className="mb-4 text-[12px] text-muted">
            {activeEvent.date} · {activeEvent.time} · {activeEvent.act}
          </div>

          {/* Credentials card */}
          <div className="mb-5 rounded-xl border border-neon/20 bg-gradient-to-br from-neon/5 to-transparent p-4">
            <div className="mb-3 font-display text-base tracking-[1.5px] text-neon">
              🔐 Access Credentials
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Event Code", value: activeEvent.code, copy: true },
                { label: "Guest PIN", value: activeEvent.ownerPin, copy: true },
                { label: "Helper PIN", value: activeEvent.helperPin, copy: true },
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
              <QrDisplay value={`https://bidabeat.app/join/${activeEvent.code}`} size={140} />
            </div>
            <div className="mt-2 font-display text-2xl tracking-[8px] text-neon">
              {activeEvent.code}
            </div>
            <div className="mb-2 text-[11px] text-muted">
              Encodes: bidabeat.app/join/{activeEvent.code}
            </div>
            <button
              onClick={() => copyText(`https://bidabeat.app/join/${activeEvent.code}`, "Guest link")}
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
            {activeEvent.seedList.length === 0 && (
              <p className="rounded-lg bg-surface-2 p-3 text-xs text-muted">
                No seed songs yet — add some to prime the queue
              </p>
            )}
            {activeEvent.seedList.map((s) => (
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
      </section>

      {/* ---- Create event modal (matches prototype exactly) ---- */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} sheet>
        <button
          aria-label="Close"
          onClick={() => setShowCreate(false)}
          className="absolute right-5 top-4 text-xl text-muted transition-colors hover:text-foreground"
        >
          ✕
        </button>
        <div className="mb-1.5 font-display text-[30px] tracking-[2px]">Create New Event</div>
        <p className="mb-[22px] text-xs text-muted">
          This event will be locked to your account — only you can manage it
        </p>

        <div className="mb-[18px] flex flex-col gap-3">
          <div className="flex flex-col gap-[5px]">
            <label className={labelCls}>Event / Venue Name</label>
            <input
              className={inputCls}
              placeholder="e.g. The Loft, Club Nova..."
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="flex gap-[10px]">
            <div className="flex flex-1 flex-col gap-[5px]">
              <label className={labelCls}>Date</label>
              <input
                type="date"
                className={inputCls}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="flex flex-1 flex-col gap-[5px]">
              <label className={labelCls}>Start Time</label>
              <input
                type="time"
                className={inputCls}
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-col gap-[5px]">
            <label className={labelCls}>Venue Address (optional)</label>
            <input
              className={inputCls}
              placeholder="e.g. 123 Main St, Chicago IL"
              value={form.venue}
              onChange={(e) => setForm({ ...form, venue: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-[5px]">
            <label className={labelCls}>Your Act Name</label>
            <input
              className={inputCls}
              placeholder="e.g. DJ Phantom, The Static Kings..."
              value={form.act}
              onChange={(e) => setForm({ ...form, act: e.target.value })}
            />
          </div>

          <div className="h-px bg-edge" aria-hidden />

          {/* Logo upload */}
          <div className="flex flex-col gap-[5px]">
            <label className={labelCls}>Event Logo / Image</label>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => previewLogo(e.target.files?.[0])}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => logoInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") logoInputRef.current?.click();
              }}
              className="cursor-pointer rounded-[10px] border-2 border-dashed border-edge bg-surface-2 p-6 text-center transition-colors hover:border-neon"
            >
              {logo ? (
                <div>
                  <img
                    src={logo}
                    alt="Event logo preview"
                    className="mx-auto mb-1.5 h-20 w-20 rounded-[10px] object-cover"
                  />
                  <div className="text-[11px] text-neon">Logo uploaded ✓</div>
                </div>
              ) : (
                <div>
                  <span className="text-[28px]" aria-hidden>🖼️</span>
                  <div className="mt-1.5 text-[13px] font-semibold">Upload Logo</div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    JPG, PNG · Recommended 400×400px
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="h-px bg-edge" aria-hidden />

          {/* Color palette / feel */}
          <div className="flex flex-col gap-[5px]">
            <label className={labelCls}>Event Feel — Choose a Color Palette</label>
            <div className="grid grid-cols-4 gap-2">
              {EVENT_PALETTES.map((p) => {
                const selected = form.palette === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setForm({ ...form, palette: p.id })}
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

          <div className="h-px bg-edge" aria-hidden />

          {/* Access credentials */}
          <div className="font-display text-base tracking-[1.5px] text-neon">
            🔐 Access Credentials
          </div>
          <div className="flex gap-[10px]">
            <div className="flex flex-1 flex-col gap-[5px]">
              <label className={labelCls}>Guest PIN (4 digits)</label>
              <input
                className={`${inputCls} font-display text-[20px] tracking-[4px]`}
                placeholder="e.g. 7823"
                inputMode="numeric"
                maxLength={4}
                value={form.pin}
                onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })}
              />
            </div>
            <div className="flex flex-1 flex-col gap-[5px]">
              <label className={labelCls}>Helper PIN (4 digits)</label>
              <input
                className={`${inputCls} font-display text-[20px] tracking-[4px]`}
                placeholder="e.g. 4411"
                inputMode="numeric"
                maxLength={4}
                value={form.helperPin}
                onChange={(e) => setForm({ ...form, helperPin: e.target.value.replace(/\D/g, "") })}
              />
            </div>
          </div>
          <div className="text-[11px] text-muted">
            Guest PIN is shared with attendees. Helper PIN gives staff queue access without
            financials.
          </div>
        </div>

        <button
          onClick={handleCreate}
          className="w-full rounded-[10px] bg-neon-2 px-4 py-[15px] text-[15px] font-bold tracking-[1px] text-white transition hover:opacity-90 active:scale-[0.99]"
        >
          CREATE EVENT & GENERATE QR →
        </button>
        <div className="mt-2.5 text-center text-[10px] text-muted">
          Event is locked to your account — no other DJ can access it
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
            <QrDisplay value={`https://bidabeat.app/join/${activeEvent.code}`} size={200} />
          </div>
          <div className="mt-3 font-display text-3xl tracking-[8px] text-neon">
            {activeEvent.code}
          </div>
          <button
            onClick={() => copyText(`https://bidabeat.app/join/${activeEvent.code}`, "Guest link")}
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