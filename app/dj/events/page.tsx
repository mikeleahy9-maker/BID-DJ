/**
 * Additional placeholder DJ pages.
 */

import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/shared/empty-state";

export default function DJEventsPage() {
  return (
    <PageContainer>
      <EmptyState
        title="No Events"
        description="Create your first event to get started managing requests and tips."
      />
    </PageContainer>
  );
}
