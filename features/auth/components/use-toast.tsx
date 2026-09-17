"use client";

import { useState, useCallback } from "react";

/**
 * Minimal toast hook for demo/feedback messages.
 * Auto-dismisses after ~2.5 seconds.
 */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);

  const show = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 2600);
  }, []);

  const toastNode = message ? (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-1/2 z-[400] -translate-x-1/2 whitespace-nowrap rounded-full border border-neon bg-surface px-5 py-2.5 text-[13px] font-semibold text-neon shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
    >
      {message}
    </div>
  ) : null;

  return { show, toastNode };
}