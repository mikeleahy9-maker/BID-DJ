"use client";

/**
 * Right-end of the guest navbar (single topbar owned by the guest layout).
 * Matches the prototype `#screen-find-event` topbar: just the guest chip
 * `👤 Alex` (muted). Log Out lives in the dashboard's Account section.
 */

export function GuestHeaderActions() {
  return (
    <span className="rounded-full border border-muted bg-surface-2 px-3 py-[5px] text-xs font-semibold text-muted">
      👤 Alex
    </span>
  );
}