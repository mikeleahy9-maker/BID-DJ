"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

export type TrackStatus = "queued" | "playing" | "played";

export interface LiveTrack {
  id: string;
  deezerId: number | null;
  title: string;
  artist: string;
  credits: number;
  bidders: number;
  coverUrl: string | null;
  status: TrackStatus;
  addedAt: string | null;
}

export interface LiveRequest {
  id: string;
  userId: string | null;
  title: string;
  artist: string;
  credits: number;
  deezerId: number | null;
  coverUrl: string | null;
  status: string;
  requestedAt: string | null;
}

const TRACK_SELECT =
  "id, deezer_id, title, artist, credits, bidders, cover_url, status, added_at";
const REQUEST_SELECT =
  "id, user_id, song_title, song_artist, credits, deezer_id, cover_url, status, requested_at";

interface TrackRow {
  id: string;
  deezer_id: number | null;
  title: string;
  artist: string;
  credits: number | null;
  bidders: number | null;
  cover_url: string | null;
  status: string;
  added_at: string | null;
}

interface RequestRow {
  id: string;
  user_id: string | null;
  song_title: string;
  song_artist: string | null;
  credits: number | null;
  deezer_id: number | null;
  cover_url: string | null;
  status: string;
  requested_at: string | null;
}

function mapTrack(row: TrackRow): LiveTrack {
  return {
    id: row.id,
    deezerId: row.deezer_id,
    title: row.title,
    artist: row.artist,
    credits: Number(row.credits ?? 0),
    bidders: Number(row.bidders ?? 0),
    coverUrl: row.cover_url,
    status: (["queued", "playing", "played"].includes(row.status)
      ? row.status
      : "queued") as TrackStatus,
    addedAt: row.added_at,
  };
}

function mapRequest(row: RequestRow): LiveRequest {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.song_title,
    artist: row.song_artist ?? "Unknown artist",
    credits: Number(row.credits ?? 0),
    deezerId: row.deezer_id,
    coverUrl: row.cover_url,
    status: row.status,
    requestedAt: row.requested_at,
  };
}

function upsertById<T extends { id: string }>(list: T[], row: T): T[] {
  const exists = list.some((item) => item.id === row.id);
  return exists ? list.map((item) => (item.id === row.id ? row : item)) : [...list, row];
}

type PostgresChange = {
  eventType: string;
  new: unknown;
  old: unknown;
};

export interface RequestSongInput {
  title: string;
  artist: string;
  credits?: number;
  deezerId?: number | null;
  coverUrl?: string | null;
}

export interface PlaceBidResult {
  ok: boolean;
  error?: string;
  creditBalance: number | null;
  /** Credits the song actually lost (down bids only). */
  drop?: number;
  /** Largest down-bid the song can accept before it would hit 0. */
  maxDown?: number;
}

export interface RefundTrackResult {
  /** Total credits paid back out to guests across every stake on the track. */
  refunded: number;
  /** Distinct guests who had a stake on the track. */
  holders: number;
}

export function useLiveQueue(eventId: string) {
  const [tracks, setTracks] = useState<LiveTrack[]>([]);
  const [allRequests, setAllRequests] = useState<LiveRequest[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    const supabase = getSupabaseClient();
    let active = true;

    supabase.auth.getUser().then((res: { data: { user: { id: string } | null } }) => {
      if (active) setMeId(res.data.user?.id ?? null);
    });

    const load = async () => {
      const [tRes, rRes] = await Promise.all([
        supabase.from("event_tracks").select(TRACK_SELECT).eq("event_id", eventId),
        supabase.from("requests").select(REQUEST_SELECT).eq("event_id", eventId),
      ]);
      if (!active) return;
      if (tRes.data) setTracks((tRes.data as TrackRow[]).map(mapTrack));
      if (rRes.data) setAllRequests((rRes.data as RequestRow[]).map(mapRequest));
      setLoaded(true);
    };
    load();

    const channel = supabase
      .channel(`live-queue-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_tracks", filter: `event_id=eq.${eventId}` },
        (payload: PostgresChange) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string };
            setTracks((prev) => prev.filter((t) => t.id !== old.id));
            return;
          }
          setTracks((prev) => upsertById(prev, mapTrack(payload.new as TrackRow)));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "requests", filter: `event_id=eq.${eventId}` },
        (payload: PostgresChange) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string };
            setAllRequests((prev) => prev.filter((r) => r.id !== old.id));
            return;
          }
          setAllRequests((prev) => upsertById(prev, mapRequest(payload.new as RequestRow)));
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  const pending = useMemo(
    () =>
      allRequests
        .filter((r) => r.status === "pending")
        .sort((a, b) => (a.requestedAt ?? "").localeCompare(b.requestedAt ?? "")),
    [allRequests]
  );

  const myRequests = useMemo(
    () => (meId ? allRequests.filter((r) => r.userId === meId) : []),
    [allRequests, meId]
  );

  const requestSong = useCallback(
    async (input: RequestSongInput) => {
      if (!eventId) return;
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("requests").insert({
        event_id: eventId,
        user_id: meId,
        song_title: input.title,
        song_artist: input.artist,
        credits: Math.max(0, Number(input.credits ?? 0)),
        deezer_id: input.deezerId ?? null,
        cover_url: input.coverUrl ?? null,
        status: "pending",
      });
      if (error) throw new Error(error.message);
    },
    [eventId, meId]
  );

  const setRequestStatus = useCallback(
    async (requestId: string, status: string) => {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("requests")
        .update({ status })
        .eq("id", requestId);
      if (error) throw new Error(error.message);
    },
    []
  );

  const approveRequest = useCallback(
    async (req: LiveRequest) => {
      if (!eventId) return;
      const supabase = getSupabaseClient();

      let existingId: string | null = null;
      if (req.deezerId) {
        const { data } = await supabase
          .from("event_tracks")
          .select("id")
          .eq("event_id", eventId)
          .eq("deezer_id", req.deezerId)
          .maybeSingle();
        existingId = (data as { id: string } | null)?.id ?? null;
      } else {
        const { data } = await supabase
          .from("event_tracks")
          .select("id")
          .eq("event_id", eventId)
          .ilike("title", req.title)
          .limit(1);
        existingId = (data as { id: string }[] | null)?.[0]?.id ?? null;
      }

      if (!existingId) {
        const { error } = await supabase.from("event_tracks").insert({
          event_id: eventId,
          title: req.title,
          artist: req.artist,
          credits: req.credits > 0 ? req.credits : 5,
          deezer_id: req.deezerId,
          cover_url: req.coverUrl,
          status: "queued",
        });
        if (error) throw new Error(error.message);
      }

      await setRequestStatus(req.id, "approved");
    },
    [eventId, setRequestStatus]
  );

  const rejectRequest = useCallback(
    async (req: LiveRequest) => {
      await setRequestStatus(req.id, "rejected");
    },
    [setRequestStatus]
  );

  const markPlaying = useCallback(
    async (trackId: string) => {
      if (!eventId) return;
      const supabase = getSupabaseClient();
      await supabase
        .from("event_tracks")
        .update({ status: "queued" })
        .eq("event_id", eventId)
        .eq("status", "playing");
      const { error } = await supabase
        .from("event_tracks")
        .update({ status: "playing" })
        .eq("id", trackId);
      if (error) throw new Error(error.message);
    },
    [eventId]
  );

  const markPlayed = useCallback(async (trackId: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("event_tracks")
      .update({ status: "played" })
      .eq("id", trackId);
    if (error) throw new Error(error.message);
  }, []);

  const markPlayedLocal = useCallback((trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, status: "played" as const } : t))
    );
  }, []);

  const removeTrackLocal = useCallback((trackId: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
  }, []);

  const refundTrack = useCallback(
    async (trackId: string): Promise<RefundTrackResult> => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.rpc("refund_track", {
        p_track_id: trackId,
      });

      if (error) {
        throw new Error(error.message);
      }

      const row = (data ?? {}) as {
        ok?: boolean;
        error?: string;
        refunded?: number;
        holders?: number;
      };
      if (!row.ok) throw new Error(row.error ?? "refund_failed");

      return {
        refunded: row.refunded ?? 0,
        holders: row.holders ?? 0,
      };
    },
    []
  );

  const placeBid = useCallback(
    async (trackId: string, amount: number): Promise<PlaceBidResult> => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.rpc("place_bid", {
        p_track_id: trackId,
        p_amount: amount,
      });

      if (error) {
        return { ok: false, error: error.message, creditBalance: null };
      }

      const row = (data ?? {}) as {
        ok?: boolean;
        error?: string;
        credit_balance?: number;
      };
      return {
        ok: Boolean(row.ok),
        error: row.error,
        creditBalance:
          typeof row.credit_balance === "number" ? row.credit_balance : null,
      };
    },
    []
  );

  const placeDownBid = useCallback(
    async (trackId: string, amount: number): Promise<PlaceBidResult> => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.rpc("place_down_bid", {
        p_track_id: trackId,
        p_amount: amount,
      });

      if (error) {
        return { ok: false, error: error.message, creditBalance: null };
      }

      const row = (data ?? {}) as {
        ok?: boolean;
        error?: string;
        credit_balance?: number;
        drop?: number;
        max_down?: number;
      };
      return {
        ok: Boolean(row.ok),
        error: row.error,
        creditBalance:
          typeof row.credit_balance === "number" ? row.credit_balance : null,
        drop: typeof row.drop === "number" ? row.drop : undefined,
        maxDown: typeof row.max_down === "number" ? row.max_down : undefined,
      };
    },
    []
  );

  return {
    tracks,
    pending,
    myRequests,
    loaded,
    requestSong,
    approveRequest,
    rejectRequest,
    markPlaying,
    markPlayed,
    markPlayedLocal,
    removeTrackLocal,
    refundTrack,
    placeBid,
    placeDownBid,
  };
}