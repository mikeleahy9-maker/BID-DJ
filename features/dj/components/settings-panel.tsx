"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";

/**
 * Account settings — profile, revenue split, payout method, PIN, danger zone.
 */

export default function SettingsPanel() {
  const { show, toastNode } = useToast();
  const [profile, setProfile] = useState({ name: "DJ Phantom", email: "phantom@bidabeat.app", url: "bidabeat.app/phantom" });
  const [pin, setPin] = useState({ current: "", next: "" });

  const inputCls =
    "w-full rounded-lg border border-edge bg-surface-2 px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-neon disabled:opacity-60";
  const labelCls = "text-[11px] uppercase tracking-[1px] text-muted";

  const section =
    "rounded-xl border border-edge bg-surface p-5 flex flex-col gap-3";

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      {/* Profile */}
      <section className={section}>
        <h2 className="font-display text-lg tracking-[1.5px] text-neon">Profile</h2>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Act / Stage Name</label>
          <input
            className={inputCls}
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Email</label>
          <input
            type="email"
            className={inputCls}
            value={profile.email}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Your BidaBeat URL</label>
          <input
            className={inputCls}
            value={profile.url}
            onChange={(e) => setProfile({ ...profile, url: e.target.value })}
          />
        </div>
        <button
          onClick={() => show("Profile saved!")}
          className="mt-1 self-start rounded-lg border border-edge bg-surface-2 px-4 py-2 text-xs font-bold text-foreground transition hover:border-neon hover:text-neon"
        >
          Save Profile
        </button>
      </section>

      {/* Revenue split */}
      <section className={section}>
        <h2 className="font-display text-lg tracking-[1.5px] text-neon">💰 Revenue Split</h2>
        <p className="text-xs leading-[1.6] text-muted">
          BidaBeat manages all payments and payouts automatically via Stripe.
        </p>
        <div className="flex flex-col gap-2">
          {[
            { icon: "🏛️", label: "Event Organizer", value: "70%", color: "text-accent" },
            { icon: "🎛️", label: "DJ / Band", value: "20%", color: "text-neon" },
            { icon: "⚡", label: "BidaBeat platform", value: "10%", color: "text-[#ff8800]" },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2.5"
            >
              <span className="flex items-center gap-2 text-[13px]">
                <span aria-hidden>{row.icon}</span>
                {row.label}
              </span>
              <span className={`font-display text-2xl ${row.color}`}>{row.value}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] leading-[1.6] text-muted">
          Unused guest credits are auto-donated to the organizer. Payouts arrive 2–3 business days
          after event end.
        </p>
      </section>

      {/* Payout method */}
      <section className={section}>
        <h2 className="font-display text-lg tracking-[1.5px] text-neon">Bank / Payout Method</h2>
        <input className={inputCls} value="••••  ••••  ••••  4242" disabled readOnly />
        <button
          onClick={() => show("Opens Stripe onboarding (demo)")}
          className="self-start rounded-lg border border-neon px-4 py-2 text-xs font-bold text-neon transition hover:bg-neon/10"
        >
          Update Payout Info
        </button>
      </section>

      {/* PIN */}
      <section className={section}>
        <h2 className="font-display text-lg tracking-[1.5px] text-neon">Owner PIN</h2>
        <p className="text-xs text-muted">
          This is your master login PIN. Keep it private — never share with helpers.
        </p>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Current PIN</label>
          <input
            type="password"
            className={inputCls}
            placeholder="••••"
            value={pin.current}
            onChange={(e) => setPin({ ...pin, current: e.target.value.replace(/\D/g, "") })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>New PIN</label>
          <input
            type="password"
            className={inputCls}
            placeholder="••••"
            value={pin.next}
            onChange={(e) => setPin({ ...pin, next: e.target.value.replace(/\D/g, "") })}
          />
        </div>
        <button
          onClick={() => {
            if (pin.next.length !== 4) return show("New PIN must be 4 digits");
            setPin({ current: "", next: "" });
            show("PIN updated!");
          }}
          className="self-start rounded-lg border border-edge bg-surface-2 px-4 py-2 text-xs font-bold text-foreground transition hover:border-neon hover:text-neon"
        >
          Update PIN
        </button>
      </section>

      {/* Danger zone */}
      <section className={`${section} border-neon-2/30`}>
        <h2 className="font-display text-lg tracking-[1.5px] text-neon-2">Danger Zone</h2>
        <button
          onClick={() => show("Contact support to delete your account")}
          className="self-start rounded-lg border border-neon-2 px-4 py-2 text-xs font-bold text-neon-2 transition hover:bg-neon-2/10"
        >
          Delete Account
        </button>
      </section>

      {toastNode}
    </div>
  );
}