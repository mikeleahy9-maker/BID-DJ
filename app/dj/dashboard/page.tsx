/**
 * DJ dashboard placeholder.
 */

import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/shared/empty-state";

export default function DJDashboardPage() {
  return (
    <PageContainer>
      <EmptyState
        title="Welcome to BidaBeat DJ"
        description="Create an event or manage your existing events."
      />
    </PageContainer>
  );
}
