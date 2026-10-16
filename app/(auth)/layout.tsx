/**
 * Auth route group layout.
 * Preserves the prototype's mobile-first 480px frame for auth screens.
 */

import React from "react";

import { ScrollToTop } from "@/components/scroll-to-top";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[480px] bg-bg">
      <ScrollToTop />
      {children}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[9999] bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,255,225,0.012)_2px,rgba(0,255,225,0.012)_4px)]"
      />
    </div>
  );
}