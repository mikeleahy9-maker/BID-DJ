/**
 * Guest route group layout.
 * Used for authenticated guest (music requester) pages.
 */

import React from "react";
import { AppHeader } from "@/components/layout/app-header";
import { siteConfig } from "@/config/site";

interface LayoutProps {
  children: React.ReactNode;
}

export const metadata = {
  title: "BidaBeat - Dashboard",
  description: "Guest dashboard",
};

export default function GuestLayout({ children }: LayoutProps) {
  return (
    <>
      <AppHeader navItems={siteConfig.guest.nav as any} />
      <main className="flex-1">{children}</main>
    </>
  );
}
