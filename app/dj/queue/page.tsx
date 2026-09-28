import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";
import QueueManager from "@/features/dj/components/queue-manager";
import {
  EVENT_PROJECTION,
  gigDateLabel,
  gigTimeLabel,
  type DbEventRow,
} from "@/features/dj/lib/dj-events";

export const metadata = { title: "Live Queue" };

export default async function DJQueuePage() {
  const user = await getCurrentUser();
  const supabase = await getSupabaseServerClient();

  let liveEvent: DbEventRow | null = null;
  if (user) {
    const { data } = await supabase
      .from("events")
      .select(EVENT_PROJECTION)
      .eq("dj_id", user.id)
      .eq("status", "live")
      .limit(1);
    if (data && data.length > 0) {
      liveEvent = data[0] as unknown as DbEventRow;
    }
  }

  const eventContext = liveEvent
    ? {
        id: liveEvent.id,
        name: liveEvent.name,
        act: liveEvent.act ?? "",
        date: gigDateLabel(liveEvent.event_date),
        time: gigTimeLabel(liveEvent.event_time),
        venue: liveEvent.venue ?? "",
        code: liveEvent.code,
        pin: liveEvent.pin ?? "",
        helperPin: liveEvent.helper_pin ?? "",
      }
    : null;

  return <QueueManager appUrl={getAppUrl()} eventContext={eventContext} />;
}