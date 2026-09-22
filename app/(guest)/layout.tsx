/**
 * Guest route group layout.
 * Single topbar: BID-A-BEAT left, guest name chip + Log Out at right end -
 * matching #screen-guest. Exactly one <header> (this one); guest pages
 * should not render their own topbars.
 */

import React from "react";
import { AppHeader } from "@/components/layout/app-header";
import { GuestHeaderActions } from "@/features/guest/components/guest-header-actions";

interface LayoutProps {
  children: React.ReactNode;
}

export const metadata = {
  title: "BidaBeat - Guest Dashboard",
  description: "Guest dashboard",
};

export default function GuestLayout({ children }: LayoutProps) {
  return (
    <>
      <AppHeader navItems={[]} rightSlot={<GuestHeaderActions />} />
      <main className="flex-1">{children}</main>
    </>
  );
}
