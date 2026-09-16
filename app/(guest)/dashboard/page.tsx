/**
 * Guest dashboard placeholder.
 */

import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/shared/empty-state";

export default function GuestDashboardPage() {
  return (
    <PageContainer>
      <EmptyState
        title="Welcome to BidaBeat"
        description="Join an event or create a new request to get started."
      />
    </PageContainer>
  );
}
