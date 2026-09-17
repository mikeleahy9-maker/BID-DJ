/**
 * AuthScreen — shell for all auth pages.
 * Renders: back link, inline BidaBeat logo, title, subtitle, then children
 * (the form and footer link). Pure layout — no business logic.
 */

import React from "react";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";

interface AuthScreenProps {
  backHref?: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export function AuthScreen({
  backHref = "/",
  title,
  subtitle,
  children,
}: AuthScreenProps) {
  return (
    <div className="flex w-full max-w-[480px] flex-col px-6 pb-12 pt-8">
      <Link
        href={backHref}
        className="mb-6 text-left text-[13px] text-muted hover:text-foreground"
      >
        ← Back
      </Link>

      <Logo size="md" className="mb-[10px]" />

      <h1 className="mb-1 font-display text-[28px] tracking-[2px] text-foreground">
        {title}
      </h1>
      <p className="mb-6 text-[13px] text-muted">{subtitle}</p>

      {children}
    </div>
  );
}

export default AuthScreen;