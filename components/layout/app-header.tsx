/**
 * AppHeader component.
 * Reusable header for authenticated pages.
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
}

export const AppHeader: React.FC<AppHeaderProps> = ({ navItems = [] }) => {
  return (
    <header className="sticky top-0 z-50 border-b border-edge bg-surface">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Logo layout="inline" className="text-[22px] tracking-[2px]" />
          </Link>

          {navItems.length > 0 && (
            <nav className="hidden md:flex gap-8">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm font-medium text-muted hover:text-foreground transition-colors"
                >
                  {item.title}
                </Link>
              ))}
            </nav>
          )}

          <div className="flex items-center gap-4">
            {/* Placeholder for user menu */}
          </div>
        </div>
      </div>
    </header>
  );
};
