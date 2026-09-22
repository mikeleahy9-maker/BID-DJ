"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { useToast } from "@/components/ui/use-toast";
import { GUEST_HISTORY } from "../data";

/**
 * GuestAccountDashboard - faithful port of the prototype's after-login
 * `#screen-find-event` (guest account dashboard).
 *
 * NOTE: the topbar (BID-A-BEAT + guest chip) is owned by the `(guest)`
 * layout - this component intentionally renders NO header.
 *
 * Mobile matches the prototype exactly (stacks in prototype order):
 *   Hero     -> Join Tonight (event code + GO + scan-QR fallback)
 *   Credits  -> Saved Credits strip
 *   History  -> Your Event History cards
 *   Stats    -> Events / Credits Spent / Songs Bid
 *   Account  -> Payment Methods . Notifications . Edit Profile . Log Out
 *
 * On `md+` it adapts to a true web dashboard:
 *   Hero     -> two-panel banner (message left, form right)
 *   Stats    -> full-width KPI row pinned at the top
 *   History  -> 2-column card grid on the left
 *   Account  -> right rail under the stats
 */
export function GuestDashboard() {
  const router = useRouter();
  const { show, toastNode } = useToast();

  const [eventCode, setEventCode] = useState("");
  const [tried, setTried] = useState(false);

  const joinNow = () => {
    const code = eventCode.trim().toUpperCase();
    if (code.length < 4) {
      setTried(true);
      show("Enter the full event code to join");
      return;
    }
    router.push(`/join/${code}`); // event landing page (prototype #screen-event)
  };

  const spentTotal = GUEST_HISTORY.reduce((n, h) => n + h.spent, 0);
  const songsTotal = GUEST_HISTORY.reduce((m, h) => m + h.songs, 0);

  const stats = [
    { value: GUEST_HISTORY.length, label: "Events" },
    { value: spentTotal, label: "Credits Spent" },
    { value: songsTotal, label: "Songs Bid" },
  ];

  const accountRows = [
    {
      icon: "💳",
      label: "Payment Methods",
      onClick: () => show("Payment methods - coming soon"),
    },
    {
      icon: "🔔",
      label: "Notifications",
      onClick: () => show("Notifications settings - coming soon"),
    },
    {
      icon: "👤",
      label: "Edit Profile",
      onClick: () => show("Profile settings - coming soon"),
    },
  ];

  return (
    <div className="min-h-full">
      {/* ---- JOIN TONIGHT hero (guest-dashboard-hero) ---- */}
      <section className="relative overflow-hidden border-b border-edge bg-[linear-gradient(160deg,#0a0a0a_0%,#111_100%)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(0,255,225,0.08)_0%,transparent_65%)]"
        />
        <div className="relative z-[1] mx-auto w-full max-w-7xl px-4 py-8 md:px-6 md:py-12">
          <div className="md:flex md:items-center md:justify-between md:gap-12">
            <div className="md:max-w-md">
              <div className="mb-2 text-[11px] uppercase tracking-[2px] text-neon">
                <span
                  className="mr-[5px] inline-block h-2 w-2 animate-pulse rounded-full bg-neon-2"
                  aria-hidden
                />
                Join Tonight
              </div>
              <h1 className="font-display text-[28px] tracking-[2px] md:text-4xl">
                Enter Event Code
              </h1>
              <p className="mt-2 hidden text-[13px] text-muted md:block">
                Type the code at the venue, or scan the QR on the screen.
              </p>
            </div>

            <div className="mt-5 w-full md:mt-0 md:max-w-sm">
              <div className="flex gap-2">
                <input
                  value={eventCode}
                  onChange={(e) => {
                    setEventCode(e.target.value.toUpperCase());
                    setTried(false);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && joinNow()}
                  maxLength={6}
                  placeholder="LOFT22"
                  aria-label="Event code"
                  className="min-w-0 flex-1 rounded-lg border border-edge bg-surface-2 px-3.5 py-[11px] text-center font-display text-[18px] font-bold tracking-[4px] text-foreground outline-none transition focus:border-neon placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:tracking-[2px] placeholder:text-muted"
                />
                <button
                  onClick={joinNow}
                  className="shrink-0 rounded-lg bg-neon px-[18px] py-[11px] text-sm font-bold tracking-[1px] text-bg transition active:opacity-85"
                >
                  Go →
                </button>
              </div>

              {tried && (
                <div className="mb-2 text-center text-xs text-neon-2 md:text-left">
                  Event not found. Check your code and try again.
                </div>
              )}

              <button
                onClick={() => {
                  show("Scan the QR code at the venue - takes you straight in");
                  setTried(false);
                }}
                className="mt-2 block w-full cursor-pointer border-none bg-transparent text-left text-xs text-white/50 md:text-left"
              >
                📷 Scan QR code at the venue instead
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Body ---- */}
      <PageContainer className="py-8 md:px-6 md:py-10">
        <div className="md:grid md:grid-cols-3 md:gap-6 md:items-start">
          {/* Left column — credits + history */}
          <section className="md:col-span-2 md:col-start-1 md:row-start-2">
            <div className="flex flex-col gap-5">
              {/* Saved Credits strip (guest-credits-strip) */}
              <div className="flex items-center justify-between rounded-xl border border-edge bg-surface px-4 py-3.5">
                <div>
                  <div className="text-[11px] uppercase tracking-[1px] text-muted">
                    Saved Credits
                  </div>
                  <div className="font-display text-[32px] leading-none text-neon">
                    20
                  </div>
                </div>
                <div className="text-right text-[11px] leading-[1.5] text-muted">
                  Available at
                  <br />
                  your next event
                </div>
              </div>

              {/* Your Event History */}
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-[11px] uppercase tracking-[2px] text-muted">
                    🕐 Your Event History
                  </div>
                  <div className="text-[11px] text-muted">
                    {GUEST_HISTORY.length} events
                  </div>
                </div>

                {GUEST_HISTORY.length === 0 && (
                  <p className="rounded-xl border border-edge bg-surface p-5 text-center text-[13px] text-muted">
                    No events yet — enter a code above to join your first one!
                  </p>
                )}

                <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                  {GUEST_HISTORY.map((h) => (
                    <button
                      key={h.name + h.date}
                      onClick={() => show("Event history detail coming soon")}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-edge bg-surface px-3.5 py-3.5 text-left transition-colors active:border-neon"
                    >
                      <span
                        className="mt-[3px] h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: h.dot }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">
                          {h.name}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted">
                          {h.dj} · {h.date}
                        </span>
                      </span>
                      <span className="ml-auto text-right">
                        <span className="font-display text-[20px] leading-none text-neon">
                          ${h.spent.toFixed(2)}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-muted">
                          {h.songs} songs bid
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </section>

          {/* Stats summary (guest-stats-row) — full-width KPI row on desktop */}
          <section className="mt-5 flex flex-row gap-2.5 md:col-span-3 md:col-start-1 md:row-start-1 md:mt-0 md:gap-5">
            {stats.map((s) => (
              <div
                key={s.label}
                className="flex-1 rounded-[10px] border border-edge bg-surface p-3.5 text-center md:px-6 md:py-5"
              >
                <div className="font-display text-[28px] tracking-[1px] text-neon md:text-[32px]">
                  {s.value}
                </div>
                <div className="mt-0.5 text-[10px] uppercase tracking-[1px] text-muted md:text-[11px]">
                  {s.label}
                </div>
              </div>
            ))}
          </section>

          {/* Account quick actions — right rail */}
          <section className="mt-5 md:col-span-1 md:col-start-3 md:row-start-2 md:mt-0">
            <div className="mb-2.5 text-[11px] uppercase tracking-[2px] text-muted">
              ⚙ Account
            </div>
            <div className="overflow-hidden rounded-xl border border-edge bg-surface">
              {accountRows.map((row) => (
                <button
                  key={row.label}
                  onClick={row.onClick}
                  className="flex w-full cursor-pointer items-center gap-3 border-b border-edge px-4 py-3.5 text-left text-[13px] transition active:bg-surface-2"
                >
                  <span aria-hidden>{row.icon}</span>
                  <span className="flex-1">{row.label}</span>
                  <span className="ml-auto text-sm text-muted" aria-hidden>
                    →
                  </span>
                </button>
              ))}

              <button
                onClick={() => router.push("/")}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left text-[13px] text-neon-2 transition active:bg-surface-2"
              >
                <span aria-hidden>🚪</span>
                <span className="flex-1">Log Out</span>
                <span className="ml-auto text-sm text-muted" aria-hidden>
                  →
                </span>
              </button>
            </div>
          </section>
        </div>
      </PageContainer>

      {toastNode}
    </div>
  );
}