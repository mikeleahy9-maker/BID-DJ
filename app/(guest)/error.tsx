/**
 * Error page for guest routes.
 */

"use client";

import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GuestError({ error, reset }: ErrorProps) {
  return (
    <PageContainer>
      <div className="flex flex-col items-center justify-center gap-6 py-20">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-gray-600 dark:text-gray-400">{error.message}</p>
        <div className="flex gap-4">
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
          <Link href="/dashboard">
            <Button variant="outline">Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}
