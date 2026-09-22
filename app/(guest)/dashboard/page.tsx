/**
 * Guest dashboard — the real bid-a-beat guest experience:
 * credits banner, request-song flow (2 credits), live bid queue,
 * and generosity (tip / gift). Client shell sits behind the
 * (guest) AppHeader layout; data is demo-seeded in features/guest/data.ts
 * and must be swapped for live Supabase rows when wired.
 */

import { GuestDashboard } from "@/features/guest/components/guest-dashboard";

export const metadata = {
  title: "Guest Dashboard",
  description: "Join an event, request songs, tip the DJ, and keep the queue live.",
};

export default function GuestDashboardPage() {
  return <GuestDashboard />;
}
