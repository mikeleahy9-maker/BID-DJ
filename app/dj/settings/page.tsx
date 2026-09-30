import { getCurrentUser, getSupabaseServerClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";
import SettingsPanel from "@/features/dj/components/settings-panel";

export const metadata = { title: "Settings" };

export default async function DJSettingsPage() {
  const user = await getCurrentUser();
  const supabase = await getSupabaseServerClient();

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("act_name, display_name, email, city, description, tags, avatar_url, public_slug")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  const initial = {
    actName: profile?.act_name ?? "",
    email: profile?.email ?? user?.email ?? "",
    city: profile?.city ?? "",
    description: profile?.description ?? "",
    tags: Array.isArray(profile?.tags) ? (profile.tags as string[]) : [],
    avatarUrl: profile?.avatar_url ?? null,
    publicSlug: profile?.public_slug ?? null,
    publicUrl: profile?.public_slug
      ? `${getAppUrl()}/dj-profile/${profile.public_slug}`
      : null,
  };

  return <SettingsPanel initial={initial} />;
}