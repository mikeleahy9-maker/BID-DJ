/**
 * Request / Enter the Queue page.
 * In-event guest experience: bid on songs in the live queue (port of
 * prototype `#screen-guest`).
 */

import { GuestQueuePage } from "@/features/guest/components/guest-queue-page";

export const metadata = {
  title: "Live Queue",
  description: "Bid to move your song up the live queue.",
};

export default function RequestPage() {
  return <GuestQueuePage />;
}