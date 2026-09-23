import { getAppUrl } from "@/lib/app-url";
import QueueManager from "@/features/dj/components/queue-manager";

export const metadata = { title: "Live Queue" };

export default function DJQueuePage() {
  return <QueueManager appUrl={getAppUrl()} />;
}