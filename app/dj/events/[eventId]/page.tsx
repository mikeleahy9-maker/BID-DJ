import { notFound } from "next/navigation";
import EventSetupPanel from "@/features/dj/components/event-setup-panel";
import { getAppUrl } from "@/lib/app-url";
import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server";
import {
  dbEventToGig,
  EVENT_PROJECTION,
  type DbEventRow,
} from "@/features/dj/lib/dj-events";

export const metadata = { title: "Event Setup" };

interface EventSetupPageProps {
  params: Promise<{
    eventId: string;
  }>;
}

export default async function EventSetupPage({ params }: EventSetupPageProps) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  const supabase = await getSupabaseServerClient();

  const { data } = await supabase
    .from("events")
    .select(EVENT_PROJECTION)
    .eq("id", eventId)
    .maybeSingle();

  if (!data || !user || (data as DbEventRow).dj_id !== user.id) {
    notFound();
  }

  return (
    <EventSetupPanel
      event={dbEventToGig(data as DbEventRow)}
      appUrl={getAppUrl()}
      dbRow={data as DbEventRow}
    />
  );
}