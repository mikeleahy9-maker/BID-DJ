"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Turns true the moment the event stops being live, so a guest/helper page can
 * close itself while it is still open.
 *
 * Postgres Changes cannot carry this signal. The only policy that lets a guest
 * or helper read an event row is `events_select_live` (status = 'live'), and
 * Realtime evaluates RLS against the *new* row, so the very UPDATE that sets
 * status='ended' is filtered out before it reaches them. Instead the DJ
 * broadcasts on a public Realtime channel (see broadcastEventClosed) and this
 * hook listens.
 *
 * A periodic/focus re-query of the events row is the safety net: a missed
 * broadcast, a backgrounded tab, or a reconnect all still converge. The row is
 * only selectable while the event is live, so a clean null read means it closed.
 */
export function useEventClosed(eventId: string): boolean {
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    const supabase = getSupabaseClient();
    let active = true;

    const close = () => {
      if (active) setClosed(true);
    };

    const channel = supabase
      .channel(`event-closed-${eventId}`)
      .on("broadcast", { event: "closed" }, close)
      .subscribe();

    // A read error (offline, transient) is not a closure; only a clean empty
    // result means the event is no longer live.
    const verify = async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id")
        .eq("id", eventId)
        .maybeSingle();
      if (!error && !data) close();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") verify();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", verify);
    const interval = window.setInterval(verify, 30000);
    verify();

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", verify);
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  return closed;
}
