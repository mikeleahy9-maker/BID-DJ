"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface OrganizerState {
  id: string;
  name: string;
  email: string;
  status: string;
  onboardedAt: string | null;
  hasStripeAccount: boolean;
}

interface OrganizerInviteProps {
  eventId: string;
}

const STATUS_COPY: Record<string, string> = {
  invited: "Invited - waiting on Stripe onboarding",
  onboarded: "Onboarded and ready for payouts",
  suspended: "Suspended by Stripe",
};

export default function OrganizerInvite({ eventId }: OrganizerInviteProps) {
  const { show, toastNode } = useToast();
  const [organizer, setOrganizer] = useState<OrganizerState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dj/events/${eventId}/organizers`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.organizer) {
          setOrganizer(json.organizer);
          setName(json.organizer.name);
          setEmail(json.organizer.email);
        }
        setTimeout(() => setLoaded(true), 0);
      })
      .catch(() => {
        if (!cancelled) setTimeout(() => setLoaded(true), 0);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setInviteUrl(null);
    try {
      const res = await fetch(`/api/dj/events/${eventId}/organizers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? "Could not invite the organizer.");
      }
      setInviteUrl(json.onboardingUrl);
      show("Organizer invited.");
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not invite the organizer.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      show("Onboarding link copied.");
    } catch {
      show("Copy failed - select the link manually.");
    }
  };

  return (
    <section className="rounded-xl border border-edge bg-surface p-5">
      <h2 className="text-[11px] uppercase tracking-[2px] text-muted">
        Event Organizer
      </h2>

      {loaded && organizer && (
        <div className="mt-3 rounded-lg border border-edge bg-surface-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">{organizer.name}</div>
              <div className="text-[11px] text-muted">{organizer.email}</div>
            </div>
            <span className="rounded-full border border-edge px-3 py-1 text-[11px] text-neon">
              {STATUS_COPY[organizer.status] ?? organizer.status}
            </span>
          </div>
          {organizer.onboardedAt && (
            <div className="mt-2 text-[11px] text-muted">
              Onboarded{" "}
              {new Date(organizer.onboardedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          )}
        </div>
      )}

      <p className="mt-3 text-sm text-muted">
        The organizer receives the event&apos;s non-DJ share and completes their own
        Stripe payout setup. They do not need a BidaBeat account.
      </p>

      <form onSubmit={invite} className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-[1px] text-muted">
            Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Venue or host name"
            className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-foreground outline-none focus:border-neon"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-[1px] text-muted">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="venue@email.com"
            className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-foreground outline-none focus:border-neon"
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-gradient-to-br from-neon to-[#00c9b1] px-5 py-3 font-display text-lg tracking-[2px] text-bg transition active:scale-[0.99] disabled:opacity-60"
          >
            {submitting
              ? "Creating…"
              : organizer
                ? "Re-send onboarding link"
                : "Invite organizer"}
          </button>
        </div>
      </form>

      {inviteUrl && (
        <div className="mt-4 rounded-lg border border-neon/30 bg-surface-2 p-4">
          <div className="text-[11px] uppercase tracking-[1px] text-neon">
            Onboarding link - send this to the organizer
          </div>
          <p className="mt-1 text-[11px] text-muted">
            Email delivery is not wired up yet, so copy this link and send it
            manually for now.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={inviteUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-lg border border-edge bg-bg px-3 py-2 font-mono text-[11px] text-foreground outline-none"
            />
            <button
              type="button"
              onClick={copyLink}
              className="shrink-0 rounded-lg border border-edge bg-surface px-4 py-2 text-sm font-semibold text-neon transition hover:border-neon"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {toastNode}
    </section>
  );
}