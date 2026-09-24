"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/shared/logo";
import { useToast } from "@/components/ui/use-toast";
import { getSupabaseClient } from "@/lib/supabase/client";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dj/events", label: "Gigs", icon: "📅" },
  { href: "/dj/queue", label: "Live Queue", icon: "🔴" },
  { href: "/dj/earnings", label: "Earnings", icon: "💰" },
  { href: "/dj/settings", label: "Settings", icon: "⚙" },
];

function isActivePath(pathname: string, href: string): boolean {
  return pathname.startsWith(href);
}

interface DjShellProps {
  children: ReactNode;
  profileName?: string;
  accountLabel?: string;
}

export function DjShell({
  children,
  profileName = "DJ",
  accountLabel = "owner account",
}: DjShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { show, toastNode } = useToast();

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.push("/");
      router.refresh();
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not sign out. Please try again.");
      setSigningOut(false);
    }
  };

  const visibleNav = NAV_ITEMS;

  const activeLabel =
    visibleNav.find((item) => isActivePath(pathname, item.href))?.label ?? "Gigs";

  const navLink = (item: NavItem) => {
    const active = isActivePath(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setDrawerOpen(false)}
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
          active
            ? "bg-neon/10 text-neon"
            : "text-muted hover:bg-surface-2 hover:text-foreground"
        }`}
      >
        <span aria-hidden className="text-base">
          {item.icon}
        </span>
        {item.label}
        {item.href === "/dj/queue" && (
          <span className="ml-auto h-2 w-2 rounded-full bg-neon-2 animate-pulse" aria-hidden />
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-bg">
      <div className="relative mx-auto w-full max-w-7xl">
        {/* ---- Desktop sidebar ---- */}
        <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-edge bg-surface lg:flex">
          <div className="flex items-center gap-2 px-5 py-5">
            <Link href="/" aria-label="BidaBeat home">
              <Logo className="text-[22px] tracking-[2px]" />
            </Link>
          </div>

          <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
            {visibleNav.map(navLink)}
          </nav>

          <div className="border-t border-edge p-3">
            <div className="flex items-center gap-3 rounded-lg bg-surface-2 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bg text-xl">
                🎛️
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{profileName}</div>
                <div className="truncate text-[11px] text-muted">{accountLabel}</div>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="mt-2 w-full rounded-lg border border-edge px-3 py-2 text-xs font-semibold text-muted hover:text-neon-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signingOut ? "Signing out…" : "Log out"}
            </button>
          </div>
        </aside>

        {/* ---- Mobile top bar ---- */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-edge bg-surface px-4 lg:hidden">
          <button
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-edge text-foreground"
          >
            ☰
          </button>
          <Link href="/" aria-label="BidaBeat home">
            <Logo className="text-[18px] tracking-[2px]" />
          </Link>
          <span className="ml-auto truncate text-[13px] font-semibold text-muted">
            {activeLabel}
          </span>
        </header>

        {/* ---- Desktop top bar ---- */}
        <header className="sticky top-0 z-30 hidden h-14 items-center gap-3 border-b border-edge bg-bg/80 px-8 backdrop-blur lg:flex lg:ml-60">
          <h1 className="text-lg font-semibold">{activeLabel}</h1>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => show("Guest preview toggled (demo)")}
              className="rounded-full border border-neon-2 px-3 py-1.5 text-xs font-semibold text-neon-2 transition hover:bg-neon-2/10"
            >
              👁 Preview
            </button>
            <span className="rounded-full border border-neon-3 px-3 py-1.5 text-xs font-semibold text-neon-3">
              🎛️ OWNER
            </span>
          </div>
        </header>

        {/* ---- Mobile drawer ---- */}
        {drawerOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/70 lg:hidden"
            onClick={() => setDrawerOpen(false)}
          >
            <div
              className="fixed inset-y-0 left-0 flex w-64 flex-col bg-surface"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-5">
                <Logo className="text-[20px] tracking-[2px]" />
                <button
                  aria-label="Close menu"
                  onClick={() => setDrawerOpen(false)}
                  className="flex h-8 w-8 items-center justify-center text-muted"
                >
                  ✕
                </button>
              </div>
              <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
                {visibleNav.map(navLink)}
              </nav>
              <div className="border-t border-edge p-4">
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="mt-2 w-full rounded-lg border border-edge px-3 py-2 text-xs font-semibold text-muted hover:text-neon-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {signingOut ? "Signing out…" : "Log out"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---- Mobile bottom nav ---- */}
        <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-edge bg-surface lg:hidden">
          {visibleNav.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold ${
                  active ? "text-neon" : "text-muted"
                }`}
              >
                <span aria-hidden className="text-lg leading-none">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* ---- Main content ---- */}
        <main className="pt-0 lg:ml-60">
          <div className="px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-10">{children}</div>
        </main>

        {toastNode}
      </div>
    </div>
  );
}

export default DjShell;