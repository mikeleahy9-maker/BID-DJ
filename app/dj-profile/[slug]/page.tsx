import type { Metadata } from "next";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";
import PublicDjProfile from "@/features/dj/components/public-dj-profile";
import type { PublicDjData, PublicEvent } from "@/features/dj/lib/public-dj";

/**
 * Public DJ profile page — /dj-profile/<slug>
 *
 * This route is deliberately OUTSIDE the /dj/* tree, because every /dj/* page
 * sits behind the authenticated dashboard layout. It must be reachable by
 * anyone with the link, including signed-out visitors.
 *
 * Data comes from the `public_dj_profile` RPC rather than a direct profiles
 * query, because the `profiles_select_own` RLS policy only lets a DJ read
 * their own row. The RPC is SECURITY DEFINER and returns only the columns
 * that are meant to be public (no email, phone, Stripe ids or activation
 * state), so the table's policies stay strict.
 */

async function getPublicDj(slug: string): Promise<PublicDjData | null> {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase.rpc("public_dj_profile", {
    p_slug: slug,
  });

  if (error) {
    console.error("[public-dj-profile] rpc failed:", error);
    return null;
  }

  const row = (data as Record<string, unknown>[] | null)?.[0];
  if (!row) return null;

  return {
    slug: String(row.slug ?? slug),
    actName: String(row.act_name ?? "DJ"),
    description: row.description ? String(row.description) : null,
    city: row.city ? String(row.city) : null,
    tags: Array.isArray(row.tags) ? (row.tags as string[]).map(String) : [],
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    memberSince: row.member_since ? String(row.member_since) : null,
    events: Array.isArray(row.events) ? (row.events as PublicEvent[]) : [],
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const dj = await getPublicDj(decodeURIComponent(slug));

  if (!dj) {
    return { title: "DJ not found" };
  }

  const description =
    dj.description ||
    [dj.actName, dj.city ? `DJ in ${dj.city}` : null, "on BidaBeat"]
      .filter(Boolean)
      .join(" · ");

  return {
    title: dj.actName,
    description,
    openGraph: {
      title: `${dj.actName} · BidaBeat`,
      description,
      url: `${getAppUrl()}/dj-profile/${dj.slug}`,
      images: dj.avatarUrl ? [{ url: dj.avatarUrl }] : undefined,
    },
  };
}

export default async function PublicDjProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dj = await getPublicDj(decodeURIComponent(slug));

  if (!dj) {
    return (
      <PublicDjProfile
        notFound
        requestedSlug={decodeURIComponent(slug)}
      />
    );
  }

  return <PublicDjProfile dj={dj} shareUrl={`${getAppUrl()}/dj-profile/${dj.slug}`} />;
}
