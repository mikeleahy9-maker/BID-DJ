/**
 * Home page.
 * Shows login and create account options.
 * This is the main landing page for BidaBeat.
 */

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/page-container";
import { Logo } from "@/components/shared/logo";
import Link from "next/link";

export default function HomePage() {
  return (
    <PageContainer>
      <section className="flex flex-col items-center justify-center gap-8 py-20">
        <div className="text-center">
          <Logo size="lg" className="mb-4 justify-center" />
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-black dark:text-white sm:text-5xl">
            The Platform for Live Music Requests
          </h1>
          <p className="mb-8 text-xl text-gray-600 dark:text-gray-400">
            Request songs, tip DJs, and enjoy the ultimate live music experience.
          </p>
        </div>

        <div className="flex gap-4">
          <Link href="/auth/login">
            <Button variant="primary" size="lg">
              Sign In
            </Button>
          </Link>
          <Link href="/auth/signup">
            <Button variant="outline" size="lg">
              Create Account
            </Button>
          </Link>
        </div>
      </section>
    </PageContainer>
  );
}
