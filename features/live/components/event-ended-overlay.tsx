"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Full-screen close-out shown to guests and helpers when the DJ ends the event.
 *
 * It auto-redirects after a beat so the page cannot sit on stale live state
 * (and, for a helper, so the helper cookie is cleared via the signout route).
 */
export function EventEndedOverlay({
  redirectTo = "/dashboard",
  delayMs = 4000,
  audience = "guest",
}: {
  redirectTo?: string;
  delayMs?: number;
  audience?: "guest" | "helper";
}) {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace(redirectTo);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [router, redirectTo, delayMs]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bg/95 px-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-edge bg-surface p-8 text-center">
        <div className="text-4xl" aria-hidden>
          🎤
        </div>
        <h1 className="mt-3 font-display text-3xl tracking-[2px] text-neon">
          Event Ended
        </h1>
        <p className="mt-3 text-sm text-muted">
          {audience === "helper"
            ? "The DJ has ended this event. Signing you out of helper mode…"
            : "The DJ has wrapped up this event. Thanks for joining — taking you back to your dashboard…"}
        </p>
      </div>
    </div>
  );
}
