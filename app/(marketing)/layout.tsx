/**
 * Marketing route group layout.
 * Used for public landing and marketing pages.
 */

import React from "react";

export const metadata = {
  title: "BidaBeat - Live Music Requests & Tipping Platform",
  description: "The platform for live music requests and tipping",
};

interface LayoutProps {
  children: React.ReactNode;
}

export default function MarketingLayout({ children }: LayoutProps) {
  return (
    <>
      <main className="flex-1">{children}</main>
    </>
  );
}
