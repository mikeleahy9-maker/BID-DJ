import { notFound } from "next/navigation";
import EventSetupPanel from "@/features/dj/components/event-setup-panel";
import type { SeedSong } from "@/features/dj/data";
import { getAppUrl } from "@/lib/app-url";
import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server";
import { getDjPlaylists } from "@/features/dj/lib/dj-playlists";
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

  const { data: tracks } = await supabase
    .from("event_tracks")
    .select("id, title, artist, credits, deezer_id, cover_url")
    .eq("event_id", eventId)
    .order("added_at", { ascending: true });

  const initialSeedList: SeedSong[] = (tracks ?? []).map((t) => ({
    id: t.deezer_id ? String(t.deezer_id) : t.id,
    deezerId: t.deezer_id,
    title: t.title,
    artist: t.artist ?? "Unknown artist",
    credits: Number(t.credits ?? 5),
    image: t.cover_url,
  }));

  const initialPlaylists = await getDjPlaylists(supabase, user.id);

  return (
    <EventSetupPanel
      event={dbEventToGig(data as DbEventRow)}
      appUrl={getAppUrl()}
      dbRow={data as DbEventRow}
      initialSeedList={initialSeedList}
      initialPlaylists={initialPlaylists}
    />
  );
}