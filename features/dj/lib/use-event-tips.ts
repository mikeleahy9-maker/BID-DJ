"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Live tip feed for the event owner.
 *
 * Loads the current tips once, then follows the `tips` table over realtime so a
 * tip that arrives mid-set appears (and toasts) without a refresh. RLS decides
 * delivery: the DJ receives only their own event's rows.
 *
 * A tip is inserted `pending` (its Stripe fee is read a moment later), so the
 * hook also listens for updates -- the row's status and fee change as the payout
 * settles, and the list reflects that instead of freezing the first snapshot.
 */

export interface EventTip {
  id: string;
  nickname: string;
  amountCents: number;
  netCents: number;
  message: string | null;
  status: string;
  createdAt: string;
}

interface TipRow {
  id: string;
  nickname: string | null;
  amount_cents: number | null;
  fee_cents: number | null;
  message: string | null;
  status: string;
  created_at: string;
}

function mapTip(row: TipRow): EventTip {
  const amount = Number(row.amount_cents ?? 0);
  const fee = Number(row.fee_cents ?? 0);
  return {
    id: row.id,
    nickname: row.nickname?.trim() || "A guest",
    amountCents: amount,
    netCents: Math.max(0, amount - fee),
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function useEventTips(
  eventId: string,
  onNewTip?: (tip: EventTip) => void
) {
  const [tips, setTips] = useState<EventTip[]>([]);
  const callbackRef = useRef(onNewTip);
  // Ids already known to this feed, so a replayed INSERT (or a realtime message
  // for a tip the initial load already returned) does not toast twice.
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    callbackRef.current = onNewTip;
  }, [onNewTip]);

  useEffect(() => {
    if (!eventId) return;
    let active = true;
    const supabase = getSupabaseClient();
    seenRef.current = new Set();

    const load = async () => {
      try {
        const res = await fetch(`/api/dj/events/${eventId}/tips`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const body = (await res.json().catch(() => null)) as
          | { tips?: EventTip[] }
          | null;
        if (!active || !body?.tips) return;
        for (const tip of body.tips) seenRef.current.add(tip.id);
        setTips(body.tips);
      } catch {
        // The feed degrades to empty rather than blocking the queue.
      }
    };
    load();

    const channel = supabase
      .channel(`event-tips-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tips",
          filter: `event_id=eq.${eventId}`,
        },
        (payload: { eventType: string; new: unknown; old: unknown }) => {
          if (!active) return;
          if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string };
            seenRef.current.delete(old.id);
            setTips((prev) => prev.filter((t) => t.id !== old.id));
            return;
          }
          const tip = mapTip(payload.new as TipRow);
          const isNewTip = !seenRef.current.has(tip.id);
          seenRef.current.add(tip.id);
          setTips((prev) =>
            prev.some((t) => t.id === tip.id)
              ? prev.map((t) => (t.id === tip.id ? tip : t))
              : [tip, ...prev]
          );
          if (payload.eventType === "INSERT" && isNewTip) {
            callbackRef.current?.(tip);
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  return tips;
}
