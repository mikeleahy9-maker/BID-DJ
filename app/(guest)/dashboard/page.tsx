/**
 * Guest dashboard — the real bid-a-beat guest experience:
 * credits banner, request-song flow (2 credits), live bid queue,
 * and generosity (tip / gift). Data comes from Supabase via
 * getGuestDashboardData (attendees + requests), so history, stats
 * and the saved-credits strip are live.
 */

import { GuestDashboard } from "@/features/guest/components/guest-dashboard";
import { getGuestDashboardData } from "@/features/guest/lib/guest-events";

export const metadata = {
  title: "Guest Dashboard",
  description: "Join an event, request songs, tip the DJ, and keep the queue live.",
};

export const dynamic = "force-dynamic";

export default async function GuestDashboardPage() {
  const data = await getGuestDashboardData();
  return <GuestDashboard data={data} />;
}