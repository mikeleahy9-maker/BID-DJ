import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { EVENT_PALETTES } from "@/features/dj/data";
import ShareProfileButton from "@/features/dj/components/share-profile-button";
import type { PublicDjData } from "@/features/dj/lib/public-dj";

function paletteNeon(palette: string | null): string {
  return EVENT_PALETTES.find((p) => p.id === palette)?.neon ?? "#00ffe1";
}

function memberSinceLabel(iso: string | null): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function eventDateLabel(date: string | null, time: string | null): string {
  if (!date) return "Date TBD";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Date TBD";
  const day = parsed.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  if (!time) return day;
  return `${day} · ${time.slice(0, 5)}`;
}

function DjAvatarImage({
  src,
  name,
}: {
  src: string | null;
  name: string;
}) {
  if (src && src.startsWith("http")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`${name} profile photo`}
        className="h-full w-full object-cover"
      />
    );
  }
  return (
    <span aria-hidden className="text-5xl leading-none">
      🎛️
    </span>
  );
}

function NotFound({ requestedSlug }: { requestedSlug: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="border-b border-edge px-6 py-4">
        <Link href="/" aria-label="BidaBeat home">
          <Logo size="sm" />
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-5xl" aria-hidden>
          🎧
        </div>
        <h1 className="font-display text-3xl tracking-[1.5px] text-foreground">
          DJ not found
        </h1>
        <p className="max-w-sm text-sm leading-[1.7] text-muted">
          We couldn&apos;t find a DJ at{" "}
          <span className="text-neon">{requestedSlug}</span>. The link may be
          mistyped, or the DJ may have changed their page address.
        </p>
        <Link
          href="/"
          className="mt-2 rounded-lg border border-edge bg-surface-2 px-4 py-2 text-xs font-bold text-foreground transition hover:border-neon hover:text-neon"
        >
          Go to BidaBeat
        </Link>
      </main>
    </div>
  );
}

/**
 * Public, shareable DJ profile. Rendered server-side and visible to anyone
 * with the link. Shows the DJ's photo (with the 🎛️ fallback), act name, city,
 * bio, tags and their live/past events.
 */
export default function PublicDjProfile({
  dj,
  shareUrl,
  notFound,
  requestedSlug,
}: {
  dj?: PublicDjData;
  shareUrl?: string;
  notFound?: boolean;
  requestedSlug?: string;
}) {
  if (notFound || !dj) {
    return <NotFound requestedSlug={requestedSlug ?? ""} />;
  }

  const since = memberSinceLabel(dj.memberSince);
  const live = dj.events.filter((e) => e.status === "live");
  const past = dj.events.filter((e) => e.status !== "live");

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="border-b border-edge px-5 py-4 sm:px-8">
        <Link href="/" aria-label="BidaBeat home">
          <Logo size="sm" />
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8 sm:py-12">
        {/* Identity */}
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:gap-6 sm:text-left">
          <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full border border-edge bg-surface-2">
            <DjAvatarImage src={dj.avatarUrl} name={dj.actName} />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="font-display text-4xl leading-none tracking-[1.5px] text-foreground sm:text-5xl">
              {dj.actName}
            </h1>
            <p className="mt-2 text-sm text-neon">/dj-profile/{dj.slug}</p>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted sm:justify-start">
              {dj.city && <span>📍 {dj.city}</span>}
              {since && <span>🎛️ On BidaBeat since {since}</span>}
            </div>
          </div>
        </div>

        {/* Tags */}
        {dj.tags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-1.5">
            {dj.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-neon/40 bg-neon/5 px-3 py-1 text-[11px] font-semibold text-neon"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Bio */}
        {dj.description ? (
          <p className="mt-6 whitespace-pre-line text-[15px] leading-[1.8] text-foreground/90">
            {dj.description}
          </p>
        ) : (
          <p className="mt-6 text-sm italic text-muted">
            This DJ hasn&apos;t added a bio yet.
          </p>
        )}

        {/* Share */}
        {shareUrl && (
          <div className="mt-7 flex flex-col gap-3 rounded-xl border border-edge bg-surface p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-[1px] text-muted">
                Shareable link
              </div>
              <div className="truncate font-mono text-xs text-neon">{shareUrl}</div>
            </div>
            <ShareProfileButton url={shareUrl} />
          </div>
        )}

        {/* Live now */}
        {live.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg tracking-[1.5px] text-neon">
              <span className="h-2 w-2 animate-pulse rounded-full bg-neon-2" />
              Live now
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {live.map((e) => (
                <EventCard key={e.id} ev={e} />
              ))}
            </div>
          </section>
        )}

        {/* Gigs */}
        {past.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 font-display text-lg tracking-[1.5px] text-muted">
              Past gigs
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {past.map((e) => (
                <EventCard key={e.id} ev={e} />
              ))}
            </div>
          </section>
        )}

        {dj.events.length === 0 && (
          <p className="mt-8 text-sm italic text-muted">
            No public gigs yet.
          </p>
        )}
      </main>

      <footer className="border-t border-edge px-5 py-5 text-center text-[11px] text-muted sm:px-8">
        Powered by{" "}
        <Link href="/" className="font-semibold text-neon">
          BidaBeat
        </Link>{" "}
        — guests bid the beat, the DJ plays it.
      </footer>
    </div>
  );
}

function EventCard({
  ev,
}: {
  ev: PublicDjData["events"][number];
}) {
  const neon = paletteNeon(ev.palette);
  const venue = [ev.venue, ev.city].filter(Boolean).join(", ");

  return (
    <div
      className="rounded-xl border border-edge bg-surface p-4"
      style={{ borderLeftColor: neon, borderLeftWidth: 3 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-display text-lg tracking-[1px] text-foreground">
            {ev.name}
          </div>
          {ev.act && <div className="truncate text-xs text-muted">{ev.act}</div>}
        </div>
        {ev.status === "live" && (
          <span className="shrink-0 rounded-full border border-neon-2 px-2 py-0.5 text-[10px] font-bold text-neon-2">
            LIVE
          </span>
        )}
      </div>
      <div className="mt-2 text-xs text-muted">
        {eventDateLabel(ev.event_date, ev.event_time)}
        {venue ? ` · ${venue}` : ""}
      </div>
    </div>
  );
}
