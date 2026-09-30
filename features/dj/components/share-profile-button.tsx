"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";

/**
 * Copy-to-clipboard button for the shareable profile URL.
 * Falls back to a selectable prompt when the Clipboard API is unavailable
 * (e.g. non-secure context), so the link is always obtainable.
 */
export default function ShareProfileButton({ url }: { url: string }) {
  const { show } = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        window.prompt("Copy your profile link:", url);
        return;
      }
      setCopied(true);
      show("Profile link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy your profile link:", url);
    }
  };

  return (
    <button
      onClick={copy}
      aria-label="Copy profile link"
      className="inline-flex items-center gap-2 rounded-lg border border-edge bg-surface-2 px-4 py-2 text-xs font-bold text-foreground transition hover:border-neon hover:text-neon"
    >
      <span aria-hidden>{copied ? "✓" : "🔗"}</span>
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
