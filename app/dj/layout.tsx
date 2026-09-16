/**
 * DJ route layout.
 * Used for DJ owner and DJ helper pages.
 */

import React from "react";
import { AppHeader } from "@/components/layout/app-header";
import { siteConfig } from "@/config/site";

interface LayoutProps {
  children: React.ReactNode;
}

export const metadata = {
  title: "BidaBeat DJ - Dashboard",
  description: "DJ dashboard",
};

export default function DJLayout({ children }: LayoutProps) {
  return (
    <>
      <AppHeader navItems={siteConfig.dj.nav} />
      <main className="flex-1">{children}</main>
    </>
  );
}
