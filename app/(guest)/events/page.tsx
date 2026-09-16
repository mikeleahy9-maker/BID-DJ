/**
 * Guest Events page.
 * Shows available events to join.
 */

import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/shared/empty-state";

export default function GuestEventsPage() {
  return (
    <PageContainer>
      <EmptyState
        title="No Available Events"
        description="Check back soon for upcoming events or ask a DJ for an event code to join."
      />
    </PageContainer>
  );
}
