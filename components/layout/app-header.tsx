/**
 * AppHeader component.
 * Reusable header for authenticated pages.
 */

import React from "react";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";

interface AppHeaderProps {
  navItems?: readonly Array<{
    title: string;
    href: string;
  }> | Array<{
    title: string;
    href: string;
  }>;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ navItems = [] }) => {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-black">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Logo size="sm" />
          </Link>

          {navItems.length > 0 && (
            <nav className="hidden md:flex gap-8">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm font-medium text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors"
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
