/**
 * DJ Earnings & Financials page.
 * Shows tips, revenue, and payout information.
 */

import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/shared/empty-state";

export default function DJEarningsPage() {
  return (
    <PageContainer>
      <EmptyState
        title="No Earnings Yet"
        description="Start hosting events and accepting tips to see your earnings."
      />
    </PageContainer>
  );
}
