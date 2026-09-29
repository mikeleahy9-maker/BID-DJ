import { getSupabaseServerClient } from "@/lib/supabase/server";
import { EVENT_PALETTES } from "@/features/dj/data";

const FALLBACK_DOTS = ["#ff6600", "#cc66ff", "#ff2d78"];

function paletteDot(palette: string | null): string {
  return (
    EVENT_PALETTES.find((p) => p.id === palette)?.dot ??
    FALLBACK_DOTS[
      Math.abs(hashString(palette ?? "noir")) % FALLBACK_DOTS.length
    ]
  );
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export interface GuestEventView {
  id: string;
  code: string;
  name: string;
  djName: string;
  badge: string;
  meta: string;
  queueCount: number;
  guestsBidding: number;
  top: { title: string; artist: string; credits: number } | null;
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
    .from("event_tracks")
    .select("id", { count: "exact", head: true })
    .eq("event_id", event.id)
    .in("status", ["queued", "playing"]);

  const top = await supabase
    .from("event_tracks")
    .select("title, artist, credits")
    .eq("event_id", event.id)
    .in("status", ["queued", "playing"])
    .order("credits", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  // Same source as the client hook, so the number doesn't change on first
  // refresh. Counts real bids (up or down), not song requests.
  const { data: bidStats } = await supabase.rpc("event_bid_stats", {
    p_event_id: event.id,
  });
  const guestsBidding = Number(
    (bidStats as { voters?: number } | null)?.voters ?? 0
  );

  const location = event.venue || event.city || "";
  const time = timeLabel(event.event_time);
  const metaParts = [
    location ? `📍 ${location}` : null,
    time ? `· ${time}` : null,
  ].filter(Boolean);
  const meta = metaParts.length ? metaParts.join("  ") : "📍 Live event · TBD";

  return {
    id: event.id,
    code: event.code,
    name: event.name,
    djName: event.act || "DJ",
    badge: `🎉 ${dateBadge(event.event_date)}`,
    meta,
    queueCount: queueCount ?? 0,
    guestsBidding,
    top:
      top.data && "title" in top.data
        ? {
            title: top.data.title,
            artist: top.data.artist,
            credits: Number(top.data.credits ?? 0),
          }
        : null,
  };
}

/**
 * Guest enters the queue for a live event: idempotently creates their
 * attendees row and grants starting credits on first join.
 */
export async function joinEventAsGuest(eventId: string): Promise<boolean> {
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc("join_event_credits", {
    p_event_id: eventId,
  });
  return !error;
}

export interface GuestHistoryEvent {
  eventId: string;
  code: string;
  name: string;
  dj: string;
  date: string;
  status: string;
  spent: number;
  songs: number;
  credits: number;
  bought: number;
  dot: string;
}

export interface GuestDashboardData {
  history: GuestHistoryEvent[];
  totalEvents: number;
  totalSpent: number;
  totalSongs: number;
  live: { code: string; name: string; balance: number } | null;
  totalBalances: number;
}

function monthDayYear(input: string | null): string {
  if (!input) return "";
  const parsed = new Date(`${input}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface GuestMyEventsRow {
  event_id: string;
  code: string;
  name: string;
  act: string | null;
  event_date: string | null;
  status: string;
  palette: string | null;
  credit_balance: number | string;
  spent: number | string;
  songs: number | string;
}

/** Guest dashboard data — every event joined, their credits + spend per event. */
export async function getGuestDashboardData(): Promise<GuestDashboardData> {
  const supabase = await getSupabaseServerClient();

  const [{ data: rows }, { data: purchases }] = await Promise.all([
    supabase.rpc("guest_my_events"),
    supabase
      .from("credit_purchases")
      .select("event_id, credits_granted"),
  ]);

  const boughtByEvent = new Map<string, number>();
  for (const p of (purchases as
    | { event_id: string; credits_granted: number }[]
    | null) ?? []) {
    boughtByEvent.set(
      p.event_id,
      (boughtByEvent.get(p.event_id) ?? 0) + p.credits_granted
    );
  }

  const history: GuestHistoryEvent[] = ((rows as GuestMyEventsRow[] | null) ?? []).map(
    (r) => ({
      eventId: r.event_id,
      code: r.code,
      name: r.name,
      dj: r.act || "DJ",
      date: monthDayYear(r.event_date),
      status: r.status,
      spent: Number(r.spent ?? 0),
      songs: Number(r.songs ?? 0),
      credits: Number(r.credit_balance ?? 0),
      bought: boughtByEvent.get(r.event_id) ?? 0,
      dot: paletteDot(r.palette),
    })
  );

  const live = history.find((h) => h.status === "live") ?? null;

  return {
    history,
    totalEvents: history.length,
    totalSpent: history.reduce((n, h) => n + h.spent, 0),
    totalSongs: history.reduce((n, h) => n + h.songs, 0),
    live: live ? { code: live.code, name: live.name, balance: live.credits } : null,
    totalBalances: history.reduce((n, h) => n + h.credits, 0),
  };
}