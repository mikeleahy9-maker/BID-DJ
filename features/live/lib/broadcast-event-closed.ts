"use client";

import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Signals every guest and helper still on the event that it just ended.
 *
 * Sends on the same public channel useEventClosed listens to. A channel must be
 * joined before it can send, and sending before SUBSCRIBED throws, so this
 * subscribes and waits (with a short cap so a stalled socket cannot wedge the
 * caller). Best-effort: the end flow has already committed, and receivers also
 * re-check on focus/interval, so a dropped message only delays the close-out.
 */
export async function broadcastEventClosed(eventId: string): Promise<void> {
  if (!eventId) return;
  const supabase = getSupabaseClient();
  const channel = supabase.channel(`event-closed-${eventId}`);

  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 2000);
    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timer);
        resolve();
      }
    });
  });

  try {
    await channel.send({ type: "broadcast", event: "closed", payload: {} });
  } catch {
    // Covered by the receivers' periodic re-check.
  } finally {
    setTimeout(() => supabase.removeChannel(channel), 1500);
  }
}
