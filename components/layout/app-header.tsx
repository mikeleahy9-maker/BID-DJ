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
}

export const AppHeader: React.FC<AppHeaderProps> = ({ navItems = [], rightSlot }) => {
  return (
    <header className="sticky top-0 z-50 border-b border-edge bg-surface">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Logo />
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

          <div className="flex items-center gap-3 min-w-0">{rightSlot}</div>
        </div>
      </div>
    </header>
  );
}
