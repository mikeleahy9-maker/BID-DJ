/**
 * AppHeader component - reusable sticky page header.
 * Logo left; optional centered nav (dashboard/event terms); optional
 * `rightSlot` node (e.g. guest name chip + Log Out) pinned far right.
 */

import React from "react";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";

export interface NavItem {
  title: string;
  href: string;
}

interface AppHeaderProps {
  navItems?: NavItem[] | ReadonlyArray<NavItem>;
  rightSlot?: React.ReactNode;
  /** Logo size. Defaults to "md"; "sm" is used on compact helper/utility headers. */
  logoSize?: "sm" | "md";
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  navItems = [],
  rightSlot,
  logoSize = "md",
}) => {
  return (
    <header className="sticky top-0 z-50 border-b border-edge bg-surface">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Logo size={logoSize} />
          </Link>

          {navItems.length > 0 && (
            <nav className="hidden md:flex gap-8">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className="text-sm text-muted transition-colors hover:text-foreground">
                  {item.title}
                </Link>
              ))}
            </nav>
          )}

          <div className="flex min-w-0 items-center gap-3">{rightSlot}</div>
        </div>
      </div>
    </header>
  );
}
