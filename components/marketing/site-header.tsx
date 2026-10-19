"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { siteConfig } from "@/config/site";

const navLinks = siteConfig.marketing.nav;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

/**
 * Public marketing header.
 * Sticky, translucent, with a compact disclosure menu on mobile.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-edge/70 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          aria-label="BidaBeat home"
          className={`flex shrink-0 items-center rounded-lg ${focusRing}`}
        >
          <Logo size="sm" />
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-8 md:flex"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg text-sm text-muted transition-colors hover:text-foreground ${focusRing}`}
            >
              {link.title}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex md:items-center">
          <Link
            href="/login"
            className={`rounded-lg bg-neon px-4 py-2 text-sm font-semibold text-bg shadow-[0_0_20px_rgba(0,255,225,0.2)] transition hover:opacity-90 ${focusRing}`}
          >
            Log In
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="marketing-mobile-menu"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          className={`inline-flex size-10 items-center justify-center rounded-lg border border-edge text-foreground transition hover:border-neon hover:text-neon md:hidden ${focusRing}`}
        >
          <span className="text-lg leading-none" aria-hidden>
            {open ? "✕" : "☰"}
          </span>
        </button>
      </div>

      {open && (
        <div
          id="marketing-mobile-menu"
          className="border-t border-edge/70 bg-bg/95 backdrop-blur-md md:hidden"
        >
          <nav
            aria-label="Mobile"
            className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-surface hover:text-foreground ${focusRing}`}
              >
                {link.title}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className={`mt-1 rounded-lg bg-neon px-4 py-2.5 text-center text-sm font-semibold text-bg ${focusRing}`}
            >
              Log In
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

export default SiteHeader;
