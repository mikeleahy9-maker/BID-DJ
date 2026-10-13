import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";
import { getDjConnectStatus } from "@/features/dj/lib/dj-connect";
import EventsManager from "@/features/dj/components/events-manager";
import type { PastEvent } from "@/features/dj/data";
import {
  dbEventToGig,
  EVENT_PROJECTION,
  type DbEventRow,
} from "@/features/dj/lib/dj-events";

export const metadata = { title: "Events & Setup" };

function pastDateLabel(input: string | null | undefined): string {
  if (!input) return "Date TBD";
  const parsed = new Date(`${input}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Date TBD";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

async function getRecentGigs(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  userId: string
): Promise<PastEvent[]> {
  const { data: pastRows } = await supabase
    .from("events")
    .select("id, name, event_date")
    .eq("dj_id", userId)
    .eq("status", "ended")
    .order("event_date", { ascending: false });

  if (!pastRows || pastRows.length === 0) return [];

  const ids = pastRows.map((row) => row.id as string);

  // Songs played is the live board's terminal state (event_tracks.status =
  // 'played'), not guest requests -- requests stop at 'approved' and are never
  // marked played, so counting them always returned 0.
  //
  // Earned is the NET amount the DJ is owed for the event
  // (event_settlements.dj_cents), the same figure the earnings page shows.
  // We no longer wait for dj_status = 'sent' to show it -- a gig that has ended
  // but not yet cleared used to read $0.00, which looked like a bug; now the
  // amount shows immediately and `status` says whether it has landed. The old
  // tip-based sum used tips.status = 'released', which nothing ever sets, so it
  // was 0 too.
  const [songsResult, settlementsResult] = await Promise.all([
    supabase
      .from("event_tracks")
      .select("event_id")
      .in("event_id", ids)
      .eq("status", "played"),
    supabase
      .from("event_settlements")
      .select("event_id, dj_cents, dj_status")
      .in("event_id", ids),
  ]);

  const songsByEvent = new Map<string, number>();
  for (const row of songsResult.data ?? []) {
    const id = row.event_id as string;
    songsByEvent.set(id, (songsByEvent.get(id) ?? 0) + 1);
  }

  const STATUS_LABEL: Record<string, string> = {
    sent: "Settled",
    held: "Processing",
    pending: "Pending",
    failed: "Failed",
  };

  const earningsByEvent = new Map<string, { cents: number; status: string }>();
  for (const row of settlementsResult.data ?? []) {
    const id = row.event_id as string;
    const djStatus = row.dj_status as string | null;
    earningsByEvent.set(id, {
      cents: Number(row.dj_cents ?? 0),
      status: (djStatus && STATUS_LABEL[djStatus]) || "Pending",
    });
  }

  return pastRows.map((row) => {
    const info = earningsByEvent.get(row.id as string);
    return {
      name: row.name as string,
      date: pastDateLabel(row.event_date as string | null),
      // Show what the DJ will get for the gig the moment it ends, not only once
      // the split has moved. The bank credit still only lands when the leg is
      // 'sent', but the DJ should always see the amount they're owed; `status`
      // tells them where that money stands.
      earned: (info?.cents ?? 0) / 100,
      songs: songsByEvent.get(row.id as string) ?? 0,
      status: info?.status,
    };
  });
}

export default async function DJEventsPage() {
  const user = await getCurrentUser();
  const supabase = await getSupabaseServerClient();
  const userId = user?.id ?? "";

  const eventsRequest = supabase
    .from("events")
    .select(EVENT_PROJECTION)
    .eq("dj_id", userId)
    .in("status", ["draft", "live"])
    .order("created_at", { ascending: false });
  const profileRequest = user
    ? supabase
        .from("profiles")
        .select("act_name, display_name, first_name, last_name, avatar_url, public_slug")
        .eq("id", user.id)
        .maybeSingle()
    : Promise.resolve({ data: null });

  const [eventsResult, profileResult] = await Promise.all([
    eventsRequest,
    profileRequest,
  ]);

  const rows = (eventsResult.data ?? []) as DbEventRow[];
  const initialEvents = rows.map(dbEventToGig);

  const recentEvents = user ? await getRecentGigs(supabase, user.id) : [];

  const connect = user ? await getDjConnectStatus(user.id) : null;

  const profile = profileResult.data as {
    act_name?: string | null;
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    avatar_url?: string | null;
    public_slug?: string | null;
  } | null;

  const ownerName =
    profile?.act_name ||
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    "DJ";

  // The owner's real public profile page. Previously this was a fabricated
  // `${host}/${slugify(act_name)}` string that pointed at no real route; it
  // now links to the actual /dj-profile/<public_slug> page.
  const publicUrl = profile?.public_slug
    ? `${getAppUrl()}/dj-profile/${profile.public_slug}`
    : null;

  const owner = {
    name: ownerName,
    handle: publicUrl ?? "Public page coming soon",
    handleUrl: publicUrl,
    avatar: profile?.avatar_url || "🎛️",
  };

  return (
    <EventsManager
      initialEvents={initialEvents}
      recentEvents={recentEvents}
      owner={owner}
      connectStatus={
        connect
          ? {
              connected: connect.connected,
              started: connect.hasAccount,
            }
          : { connected: false, started: false }
      }
    />
  );
}