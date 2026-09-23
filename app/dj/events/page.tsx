import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server";
import { getAppHost } from "@/lib/app-url";
import EventsManager from "@/features/dj/components/events-manager";
import {
  dbEventToGig,
  EVENT_PROJECTION,
  type DbEventRow,
} from "@/features/dj/lib/dj-events";

export const metadata = { title: "Events & Setup" };

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function DJEventsPage() {
  const user = await getCurrentUser();
  const supabase = await getSupabaseServerClient();

  const eventsRequest = supabase
    .from("events")
    .select(EVENT_PROJECTION)
    .order("created_at", { ascending: false });
  const profileRequest = user
    ? supabase
        .from("profiles")
        .select("act_name, display_name, first_name, last_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle()
    : Promise.resolve({ data: null });

  const [eventsResult, profileResult] = await Promise.all([
    eventsRequest,
    profileRequest,
  ]);

  const rows = (eventsResult.data ?? []) as DbEventRow[];
  const initialEvents = rows.map(dbEventToGig);

  const profile = profileResult.data as {
    act_name?: string | null;
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    avatar_url?: string | null;
  } | null;

  const ownerName =
    profile?.act_name ||
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    "DJ";
  const handleBase = profile?.act_name || profile?.first_name || "dj";

  const owner = {
    name: ownerName,
    handle: `${getAppHost()}/${slugify(handleBase)}`,
    avatar: profile?.avatar_url || "🎛️",
  };

  return <EventsManager initialEvents={initialEvents} owner={owner} />;
}