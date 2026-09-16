/**
 * Join event page placeholder.
 * Guests can join events using event codes.
 */

import { PageContainer } from "@/components/layout/page-container";

interface JoinEventPageProps {
  params: Promise<{
    eventCode: string;
  }>;
}

export default async function JoinEventPage({ params }: JoinEventPageProps) {
  const { eventCode } = await params;

  return (
    <PageContainer>
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-bold">Join Event</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Event code: {eventCode}
        </p>
      </div>
    </PageContainer>
  );
}
