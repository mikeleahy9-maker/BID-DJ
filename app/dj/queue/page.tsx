/**
 * DJ Queue Management page.
 * For managing song requests and tips.
 */

import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/shared/empty-state";

export default function DJQueuePage() {
  return (
    <PageContainer>
      <EmptyState
        title="No Active Queue"
        description="Start an event to begin receiving song requests."
      />
    </PageContainer>
  );
}
