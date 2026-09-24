import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface GuestEventView {
  code: string;
  name: string;
  djName: string;
  badge: string;
  meta: string;
  queueCount: number;
  guestCount: number;
  topTitle: string;
  topArtist: string;
}

function dateBadge(input: string | null): string {
  if (!input) return "TONIGHT";
  const parsed = new Date(`${input}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "TONIGHT";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const diffDays = Math.round((target.getTime() - startOfToday.getTime()) / 86_400_000);

  if (diffDays === 0) return "TONIGHT";
  if (diffDays === 1) return "TOMORROW";
  if (diffDays > 1 && diffDays <= 7) {
    return parsed.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  }
  return parsed
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();
}

function timeLabel(input: string | null): string {
  if (!input) return "";
  const [hStr, mStr] = input.split(":").map(Number);
  if (Number.isNaN(hStr) || Number.isNaN(mStr)) return "";
  const hour12 = hStr % 12 === 0 ? 12 : hStr % 12;
  const suffix = hStr < 12 ? "AM" : "PM";
  return mStr === 0
    ? `${hour12} ${suffix}`
    : `${hour12}:${String(mStr).padStart(2, "0")} ${suffix}`;
}

export async function getLiveEventForGuest(
  code: string
): Promise<GuestEventView | null> {
  const supabase = await getSupabaseServerClient();
  const normalized = code.trim().toUpperCase();

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, name, act, event_date, event_time, venue, city, code, status"
    )
    .eq("code", normalized)
    .maybeSingle();

  if (!event) return null;

  const { count: queueCount } = await supabase
    .from("requests")
    .select("id", { count: "exact", head: true })
    .eq("event_id", event.id)
    .in("status", ["pending", "playing"]);

  const { count: guestCount } = await supabase
    .from("attendees")
    .select("id", { count: "exact", head: true })
    .eq("event_id", event.id);

  const { data: top } = await supabase
    .from("requests")
    .select("song_title, song_artist, tip_amount")
    .eq("event_id", event.id)
    .in("status", ["pending", "playing"])
    .order("tip_amount", { ascending: false })
    .limit(1)
    .maybeSingle();

  const location = event.venue || event.city || "";
  const time = timeLabel(event.event_time);
  const metaParts = [
    location ? `📍 ${location}` : null,
    time ? `· ${time}` : null,
  ].filter(Boolean);
  const meta = metaParts.length ? metaParts.join("  ") : "📍 Live event · TBD";

  return {
    code: event.code,
    name: event.name,
    djName: event.act || "DJ",
    badge: `🎉 ${dateBadge(event.event_date)}`,
    meta,
    queueCount: queueCount ?? 0,
    guestCount: guestCount ?? 0,
    topTitle: top?.song_title ?? "No songs yet",
    topArtist: top
      ? `${top.song_artist || "Unknown artist"} · ${Math.round(Number(top.tip_amount))} credits`
      : "Be the first to request a song",
  };
}