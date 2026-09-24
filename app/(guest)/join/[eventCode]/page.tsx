/**
 * Join event page.
 * Guests can join events using event codes — the event landing screen
 * (port of prototype `#screen-event`).
 *
 * The event is fetched server-side via the guest session (RLS only exposes
 * live events), so an unknown/past code renders an inline not-found instead
 * of a demo screen.
 */

import { PageContainer } from "@/components/layout/page-container";
import { GuestEventPage } from "@/features/guest/components/guest-event-page";
import { getLiveEventForGuest } from "@/features/guest/lib/guest-events";

interface JoinEventPageProps {
  params: Promise<{
    eventCode: string;
  }>;
}

export default async function JoinEventPage({ params }: JoinEventPageProps) {
  const { eventCode } = await params;
  const event = await getLiveEventForGuest(eventCode);

  if (!event) {
    return (
      <PageContainer className="py-16 md:py-24">
        <div className="mx-auto max-w-md rounded-xl border border-edge bg-surface p-8 text-center">
          <div className="text-4xl" aria-hidden>
            🙅
          </div>
          <h1 className="mt-3 font-display text-2xl tracking-[2px]">
            Event Not Found
          </h1>
          <p className="mt-2 text-sm text-muted">
            No live event matches the code{" "}
            <span className="font-bold tracking-[3px] text-neon">
              {eventCode.toUpperCase()}
            </span>
            . Check your code and try again.
          </p>
          <a
            href="/dashboard"
            className="mt-6 inline-block rounded-lg bg-neon px-6 py-2.5 text-sm font-bold tracking-[1px] text-bg transition active:opacity-85"
          >
            ← Back to Dashboard
          </a>
        </div>
      </PageContainer>
    );
  }

  return <GuestEventPage eventCode={event.code} event={event} />;
}