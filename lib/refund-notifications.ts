import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail, guestSongRefundEmail } from "@/lib/email";

/**
 * Emails each guest whose stake was returned when a song is refunded.
 *
 * Best-effort by design: a refund must succeed even if mail cannot be sent, so
 * this never throws. Callers invoke it AFTER the refund has committed, which is
 * why the new balances it reads already include the returned credits.
 *
 * The bid rows are deleted by the refund (cascade), so the per-user stake has
 * to be snapshotted before the refund and passed in here.
 */
export async function notifyRefundedGuests(params: {
  eventId: string;
  trackTitle: string;
  trackArtist: string;
  perUser: Map<string, number>;
}): Promise<void> {
  const userIds = [...params.perUser.keys()];
  if (userIds.length === 0) return;

  try {
    const admin = getSupabaseAdmin();

    const [eventRes, profilesRes, attendeesRes] = await Promise.all([
      admin.from("events").select("name").eq("id", params.eventId).maybeSingle(),
      admin
        .from("profiles")
        .select("id, first_name, last_name, email, act_name, display_name")
        .in("id", userIds),
      admin
        .from("attendees")
        .select("user_id, credit_balance")
        .eq("event_id", params.eventId)
        .in("user_id", userIds),
    ]);

    const eventName = eventRes.data?.name;
    if (!eventName) return;

    const profiles = new Map(
      (profilesRes.data ?? []).map((p) => [p.id as string, p])
    );
    const balances = new Map(
      (attendeesRes.data ?? []).map((a) => [
        a.user_id as string,
        Number(a.credit_balance ?? 0),
      ])
    );

    await Promise.all(
      [...params.perUser.entries()].map(async ([userId, credits]) => {
        const profile = profiles.get(userId);
        if (!profile?.email) return;

        const guestName =
          profile.act_name ||
          profile.display_name ||
          [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
          "there";

        const delivery = await sendEmail({
          to: profile.email,
          ...guestSongRefundEmail({
            guestName,
            eventName,
            trackTitle: params.trackTitle,
            trackArtist: params.trackArtist,
            credits,
            newBalance: balances.get(userId) ?? credits,
          }),
        });
        if (!delivery.ok) {
          console.warn(
            `[refund] could not email guest ${profile.email}:`,
            delivery.error
          );
        }
      })
    );
  } catch (err) {
    console.warn("[refund] guest refund email failed (non-fatal):", err);
  }
}
