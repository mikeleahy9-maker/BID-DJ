/**
 * Global not found page.
 */

"use client";

import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <PageContainer>
      <div className="flex flex-col items-center justify-center gap-6 py-20">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          Page not found
        </p>
        <Link href="/">
          <Button variant="primary">Go Home</Button>
        </Link>
      </div>
    </PageContainer>
  );
}
