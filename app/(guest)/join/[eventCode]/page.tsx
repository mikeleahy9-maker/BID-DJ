/**
 * Join event page.
 * Guests can join events using event codes — the event landing screen
 * (port of prototype `#screen-event`).
 */

import { GuestEventPage } from "@/features/guest/components/guest-event-page";

interface JoinEventPageProps {
  params: Promise<{
    eventCode: string;
  }>;
}

export default async function JoinEventPage({ params }: JoinEventPageProps) {
  const { eventCode } = await params;

  return <GuestEventPage eventCode={eventCode} />;
}