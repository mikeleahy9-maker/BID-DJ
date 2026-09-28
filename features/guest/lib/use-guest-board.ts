"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

export interface GuestBoardTop {
  title: string;
  artist: string;
  credits: number;
}

interface BoardTopRow {
  title: string;
  artist: string;
  credits: number | null;
}

const ACTIVE_STATUSES = ["queued", "playing"];

export function useGuestBoard(
  eventId: string,
  initial: {
    queueCount: number;
    guestsBidding: number;
    top: GuestBoardTop | null;
  }
) {
  const [queueCount, setQueueCount] = useState(initial.queueCount);
  const [guestsBidding, setGuestsBidding] = useState(initial.guestsBidding);
  const [top, setTop] = useState<GuestBoardTop | null>(initial.top);

  const load = useCallback(async () => {
    if (!eventId) return;
    const supabase = getSupabaseClient();

    // Guests can't read other guests' bids (bids RLS is own-stake-or-DJ), so
    // the event-wide count comes from a definer RPC that returns aggregates
    // only. Falls back to the server value if the RPC is unavailable.
    const [countRes, topRes, statsRes] = await Promise.all([
      supabase
        .from("event_tracks")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .in("status", ACTIVE_STATUSES),
      supabase
        .from("event_tracks")
        .select("title, artist, credits")
        .eq("event_id", eventId)
        .in("status", ACTIVE_STATUSES)
        .order("credits", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle(),
      supabase.rpc("event_bid_stats", { p_event_id: eventId }),
    ]);

    setQueueCount(countRes.count ?? 0);

    const stats = statsRes.data as { voters?: number } | null;
    if (statsRes.error) {
      console.warn("event_bid_stats unavailable", statsRes.error.message);
    } else {
      setGuestsBidding(Number(stats?.voters ?? 0));
    }

    const row = topRes.data as BoardTopRow | null;
    setTop(
      row
        ? {
            title: row.title,
            artist: row.artist,
            credits: Number(row.credits ?? 0),
          }
        : null
    );
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    const supabase = getSupabaseClient();
    let active = true;

    const refresh = () => {
      if (active) load();
    };

    // event_tracks is public while the event is live, and every bid mutates a
    // track row, so this subscription keeps the counts live without exposing
    // individual bids.
    const channel = supabase
      .channel(`guest-board-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_tracks",
          filter: `event_id=eq.${eventId}`,
        },
        refresh
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [eventId, load]);

  return { queueCount, guestsBidding, top };
}