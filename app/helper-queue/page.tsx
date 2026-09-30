import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/app-url";
import { readHelperSession } from "@/lib/helper-session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/layout/app-header";
import QueueManager from "@/features/dj/components/queue-manager";
import {
  EVENT_PROJECTION,
  gigDateLabel,
  gigTimeLabel,
  type DbEventRow,
} from "@/features/dj/lib/dj-events";

export const metadata = { title: "Helper Queue" };

export default async function HelperQueuePage() {
  const helper = await readHelperSession();
  if (!helper) {
    redirect("/dj-login");
  }

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("events")
    .select(EVENT_PROJECTION)
    .eq("code", helper.code)
    .eq("status", "live")
    .limit(1);
  const liveEvent = data && data.length > 0 ? (data[0] as unknown as DbEventRow) : null;

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

  return (
    <>
      <AppHeader
        logoSize="sm"
        rightSlot={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="rounded-full border border-neon-3 bg-surface-2 px-3 py-[5px] text-xs font-bold text-neon-3">
              🤝 HELPER
            </span>
            <form action="/helper-queue/signout" method="post">
              <button
                type="submit"
                className="cursor-pointer rounded-full border border-edge bg-surface-2 px-3 py-[5px] text-xs font-bold text-foreground transition hover:border-neon-3 hover:text-neon-3"
              >
                <span className="hidden sm:inline">↩ Exit Helper Mode</span>
                <span className="sm:hidden">↩ Exit</span>
              </button>
            </form>
          </div>
        }
      />
      <div className="border-b border-neon-3/30 bg-gradient-to-br from-neon-3/15 to-neon-3/5 px-4 py-2 text-center text-[11px] font-semibold tracking-[1px] text-neon-3">
        🤝 HELPER MODE — Queue management only. Contact the owner to end the event.
      </div>
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 bg-bg px-4 py-6">
        <QueueManager
          appUrl={getAppUrl()}
          eventContext={eventContext}
          helperMode
        />
      </main>
    </>
  );
}