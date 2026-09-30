"use client";

import { useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/use-toast";

/**
 * GuestHireModal - port of the prototype's booking modal (openHireModal).
 * DJ profile header, genre tags, stats, bio, and the booking request form.
 * Mobile renders as a bottom sheet; desktop as a centered dialog.
 */

const DEFAULT_BIO =
  "This DJ hasn't added a bio yet. Send a booking request and they'll get back to you.";

export function GuestHireModal({
  open,
  onClose,
  dj,
}: {
  open: boolean;
  onClose: () => void;
  dj: {
    name: string;
    profileUrl: string | null;
    avatarUrl: string | null;
    bio: string | null;
    tags: string[];
  };
}) {
  const { show, toastNode } = useToast();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    date: "",
    type: "",
    message: "",
  });

  const submit = () => {
    if (!form.name.trim() || !form.email.trim()) {
      show("Please enter your name and email");
      return;
    }
    if (!form.date) {
      show("Please select an event date");
      return;
    }
    if (!form.type) {
      show("Please select an event type");
      return;
    }
    onClose();
    show("Booking request sent! They'll be in touch 🎛️");
  };

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <>
      <Modal open={open} onClose={onClose} sheet className="md:max-w-lg">
        {/* close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-5 top-4 cursor-pointer border-none bg-transparent text-xl text-muted"
        >
          ✕
        </button>

        {/* DJ profile header */}
        <div className="mb-3.5 flex items-center gap-3.5">
          <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-neon-2/40 bg-surface-2 text-[36px]">
            {dj.avatarUrl && dj.avatarUrl.startsWith("http") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dj.avatarUrl}
                alt={dj.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span aria-hidden>🎛️</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="font-display text-[28px] leading-none tracking-[2px]">
              {dj.name}
            </div>
            {dj.profileUrl ? (
              <Link
                href={dj.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block truncate text-[11px] text-neon transition hover:text-neon-2"
              >
                View full profile →
              </Link>
            ) : (
              <div className="mt-1 text-[11px] text-muted">DJ</div>
            )}
          </div>
        </div>

        {/* Tags from the DJ's real profile */}
        {dj.tags.length > 0 && (
          <div className="mb-3.5 flex flex-wrap gap-1.5">
            {dj.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-neon/40 bg-neon/5 px-2.5 py-1 text-[11px] font-semibold text-neon"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Bio */}
        <div className="rounded-lg bg-surface-2 px-3.5 py-3 text-[13px] leading-[1.6] text-muted">
          {dj.bio || DEFAULT_BIO}
        </div>

        <div className="my-4 h-px bg-edge" />

        {/* Booking form */}
        <div className="mb-3.5 font-display text-[18px] tracking-[1.5px] text-neon">
          Book This DJ/Band
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-[11px] text-muted">
              Your Name
            </label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Your full name"
              className="w-full rounded-lg border border-edge bg-surface-2 px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-neon placeholder:text-muted/70"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-muted">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="you@email.com"
              className="w-full rounded-lg border border-edge bg-surface-2 px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-neon placeholder:text-muted/70"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-muted">
              Phone (optional)
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="(555) 000-0000"
              className="w-full rounded-lg border border-edge bg-surface-2 px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-neon placeholder:text-muted/70"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] text-muted">
                Event Date
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                className="w-full rounded-lg border border-edge bg-surface-2 px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-neon"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-muted">
                Event Type
              </label>
              <select
                value={form.type}
                onChange={(e) => set("type", e.target.value)}
                className="w-full cursor-pointer rounded-lg border border-edge bg-surface-2 px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-neon"
              >
                <option value="">Select...</option>
                <option>Wedding</option>
                <option>Birthday Party</option>
                <option>Corporate Event</option>
                <option>Club / Bar Night</option>
                <option>Private Party</option>
                <option>Festival</option>
                <option>Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-muted">
              Message (optional)
            </label>
            <textarea
              value={form.message}
              onChange={(e) => set("message", e.target.value)}
              placeholder="Tell them about your event — vibe, venue, guest count..."
              rows={3}
              className="w-full resize-none rounded-lg border border-edge bg-surface-2 px-3.5 py-3 text-sm leading-[1.5] text-foreground outline-none transition focus:border-neon placeholder:text-muted/70"
            />
          </div>
        </div>

        <button
          onClick={submit}
          className="mt-4 w-full cursor-pointer rounded-[10px] border-none bg-[linear-gradient(135deg,#ff2d78,#cc1155)] px-4 py-3.5 text-[15px] font-bold tracking-[1px] text-white"
        >
          SEND BOOKING REQUEST 🎛️
        </button>
        <div className="mt-2.5 text-center text-[10px] text-muted">
          The DJ/Band will receive your contact info and get back to you
          directly
        </div>
      </Modal>
      {toastNode}
    </>
  );
}