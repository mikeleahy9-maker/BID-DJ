/**
 * Marketing route group layout.
 *
 * Full-width so public marketing pages can breathe on tablet/desktop.
 * Individual pages own their own inner max-width containers; the legal
 * pages stay centered with a 360px reading column.
 */

import React from "react";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen w-full bg-bg">
      {children}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[9999] bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,255,225,0.012)_2px,rgba(0,255,225,0.012)_4px)]"
      />
    </div>
  );
}
