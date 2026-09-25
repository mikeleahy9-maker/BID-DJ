"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/use-toast";
import {
  EVENT_PALETTES,
  DJEvent,
  type PastEvent,
} from "@/features/dj/data";
import { dbEventToGig, randomPin, type DbEventRow } from "@/features/dj/lib/dj-events";

interface EventsManagerProps {
  initialEvents: DJEvent[];
  recentEvents: PastEvent[];
  owner: { name: string; handle: string; avatar: string };
}

const EMPTY_FORM = {
  name: "",
  act: "",
  date: "",
  time: "21:00",
  venue: "",
  pin: "",
  helperPin: "",
  palette: "noir",
};

export default function EventsManager({
  initialEvents,
  recentEvents,
  owner,
}: EventsManagerProps) {
  const { show, toastNode } = useToast();
  const router = useRouter();
  const [events, setEvents] = useState<DJEvent[]>(initialEvents);
  const [showCreate, setShowCreate] = useState(false);
  const [goingLiveId, setGoingLiveId] = useState<string | null>(null);

  const goLive = async (id: string) => {
    setGoingLiveId(id);
    try {
      const res = await fetch(`/api/dj/events/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "live" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not go live");
      setEvents((prev) =>
        prev.map((ev) => (ev.id === id ? { ...ev, status: "live" } : ev))
      );
      router.push("/dj/queue");
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not go live");
    } finally {
      setGoingLiveId(null);
    }
  };

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
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
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
    if (form.helperPin && form.helperPin.length < 6) {
      show("Helper PIN must be 6 digits");
      return;
    }
    if (form.helperPin && !/^\d{6}$/.test(form.helperPin)) {
      show("Helper PIN must be 6 digits");
      return;
    }
    if (form.pin === form.helperPin) {
      show("Guest PIN and Helper PIN must be different");
      return;
    }

    setCreating(true);
    try {
      const fd = new FormData();
      fd.set("name", form.name.trim());
      fd.set("act", form.act.trim());
      fd.set("date", form.date);
      fd.set("time", form.time);
      fd.set("venue", form.venue.trim());
      fd.set("pin", form.pin);
      fd.set("helperPin", form.helperPin);
      fd.set("palette", form.palette);
      const logoFile = logoInputRef.current?.files?.[0];
      if (logoFile) fd.set("logo", logoFile);

      const res = await fetch("/api/dj/events", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.event) {
        show(data?.error ?? "Could not create the event. Please try again.");
        return;
      }

      const created = dbEventToGig(data.event as DbEventRow);
      setEvents((prev) => [created, ...prev]);
      setShowCreate(false);
      setForm(EMPTY_FORM);
      setLogo(null);
      if (logoInputRef.current) logoInputRef.current.value = "";
      show(`"${created.name}" created! Code: ${created.code} 🎉`);
    } catch {
      show("Could not reach the server. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const previewLogo = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === "string") setLogo(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const openCreate = () => {
    const helperPin = randomPin(6);
    const pin = randomPin(4, helperPin);
    setForm({ ...EMPTY_FORM, pin, helperPin });
    setLogo(null);
    setShowCreate(true);
  };

  const inputCls =
    "w-full rounded-lg border border-edge bg-surface-2 px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-neon";
  const labelCls = "text-[11px] uppercase tracking-[1px] text-muted";

  return (
    <div className="flex flex-col gap-6">
      {/* Owner profile strip */}
      <section className="flex flex-wrap items-center gap-4 rounded-xl border border-edge bg-surface p-4">
        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-surface-2 text-2xl">
          {owner.avatar.startsWith("http") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={owner.avatar} alt={owner.name} className="h-full w-full object-cover" />
          ) : (
            owner.avatar
          )}
        </div>
        <div>
          <div className="font-display text-xl tracking-[1.5px]">{owner.name}</div>
          <div className="text-[11px] text-neon">{owner.handle}</div>
        </div>
        <Link
          href="/dj/settings"
          className="ml-auto rounded-lg border border-edge bg-surface-2 px-4 py-2 text-xs font-bold text-foreground transition hover:border-neon hover:text-neon"
        >
          ⚙
        </Link>
      </section>

      {/* Full-width gigs list */}
      <div className="flex flex-col gap-4">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-[11px] uppercase tracking-[2px] text-muted">Upcoming Gigs</h2>
            <button
              onClick={openCreate}
              className="rounded-lg border border-neon px-3 py-1.5 text-[11px] font-bold text-neon transition hover:bg-neon/10"
            >
              + New Event
            </button>
          </div>
          <div className="flex flex-col gap-2.5">
            {events.length === 0 && (
              <p className="rounded-xl border border-dashed border-edge bg-surface/60 p-6 text-center text-sm text-muted">
                No upcoming gigs yet — hit &quot;+ New Event&quot; to create your first one
              </p>
            )}
            {events.map((ev) => (
              <div
                key={ev.id}
                className="relative overflow-hidden rounded-xl border border-edge bg-surface p-4 transition-colors"
              >
                <span className="absolute inset-y-0 left-0 w-[3px] bg-neon" aria-hidden />
                <div className="font-display text-xl tracking-[1.5px]">{ev.name}</div>
                <div className="mt-1 text-[11px] text-muted">
                  {ev.date} · {ev.time} · Code:{" "}
                  <span className="font-semibold text-neon">{ev.code}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/dj/events/${ev.id}`}
                    className="flex-1 rounded-lg border border-neon bg-neon/5 px-3 py-2 text-center text-[11px] font-bold text-neon transition hover:bg-neon/15"
                  >
                    ⚙ Setup & QR
                  </Link>
                  <button
                    disabled={goingLiveId === ev.id}
                    onClick={() => goLive(ev.id)}
                    className={[
                      "flex-1 rounded-lg border px-3 py-2 text-center text-[11px] font-bold transition",
                      ev.status === "live"
                        ? "border-neon-2 bg-neon-2/10 text-neon-2"
                        : "border-neon-2 text-neon-2 hover:bg-neon-2/10",
                      goingLiveId === ev.id ? "opacity-60" : "",
                    ].join(" ")}
                  >
                    {goingLiveId === ev.id
                      ? "Going live…"
                      : ev.status === "live"
                        ? "● LIVE"
                        : "▶ Go Live"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-[11px] uppercase tracking-[2px] text-muted">Recent Gigs</h2>
          <div className="overflow-hidden rounded-xl border border-edge bg-surface">
            {recentEvents.length === 0 && (
              <p className="p-6 text-center text-sm text-muted">
                No past gigs yet — ended events will show up here
              </p>
            )}
            {recentEvents.map((ev) => (
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
              <div className="flex gap-1.5">
                <input
                  className={`${inputCls} font-display text-[20px] tracking-[4px]`}
                  placeholder="e.g. 7823"
                  inputMode="numeric"
                  maxLength={4}
                  value={form.pin}
                  onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })}
                />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, pin: randomPin(4, form.helperPin) })}
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
                  value={form.helperPin}
                  onChange={(e) => setForm({ ...form, helperPin: e.target.value.replace(/\D/g, "") })}
                />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, helperPin: randomPin(6, form.pin) })}
                  aria-label="Generate random helper PIN"
                  title="Generate random helper PIN"
                  className="shrink-0 rounded-lg border border-edge bg-surface-2 px-3 text-lg transition hover:border-neon"
                >
                  🎲
                </button>
              </div>
            </div>
          </div>
          <div className="text-[11px] text-muted">
            Guest PIN is shared with attendees. Helper PIN gives staff queue access without
            financials.
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full rounded-[10px] bg-neon-2 px-4 py-[15px] text-[15px] font-bold tracking-[1px] text-white transition hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {creating ? "CREATING…" : "CREATE EVENT & GENERATE QR →"}
        </button>
        <div className="mt-2.5 text-center text-[10px] text-muted">
          Event is locked to your account — no other DJ can access it
        </div>
      </Modal>

      {toastNode}
    </div>
  );
}