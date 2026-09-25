import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server";
import { getDjPlaylists } from "@/features/dj/lib/dj-playlists";
import PlaylistsManager from "@/features/dj/components/playlists-manager";

export const metadata = { title: "Playlists" };

export default async function DJPlaylistsPage() {
  const user = await getCurrentUser();
  const supabase = await getSupabaseServerClient();
  const playlists = user ? await getDjPlaylists(supabase, user.id) : [];

  return <PlaylistsManager initialPlaylists={playlists} />;
}