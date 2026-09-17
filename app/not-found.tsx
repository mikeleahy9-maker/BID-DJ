/**
 * Global not found page.
 */

import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <PageContainer>
      <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
        <h1 className="font-display text-4xl tracking-widest text-neon">404</h1>
        <p className="text-lg text-muted">Page not found</p>
        <Link href="/">
          <Button variant="primary">Go Home</Button>
        </Link>
      </div>
    </PageContainer>
  );
}