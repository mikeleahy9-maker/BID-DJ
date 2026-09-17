"use client";

import { FormEvent, useState } from "react";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "./use-toast";

type DJRole = "owner" | "helper";

/**
 * DJ / Band login form with Owner/Helper role selector.
 * Faithful port of screen-dj-login. Helper login becomes PIN-based
 * when auth is wired up.
 */

export default function DJLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<DJRole>("owner");
  const [error, setError] = useState<string | null>(null);
  const { show, toastNode } = useToast();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    setError(null);
    show(
      role === "owner"
        ? "✓ Welcome back! (DJ dashboard — coming soon)"
        : "✓ Helper PIN check — coming soon"
    );
  };

  const roleOpt = (value: DJRole, icon: string, title: string, sub: string) => (
    <button
      type="button"
      onClick={() => setRole(value)}
      className={`flex flex-1 cursor-pointer items-center gap-2.5 rounded-[10px] border p-3 text-left transition active:scale-[0.97] ${
        role === value
          ? "border-neon-3 bg-neon-3/5"
          : "border-edge bg-surface-2 text-foreground"
      }`}
    >
      <span className="shrink-0 text-[20px]" aria-hidden>
        {icon}
      </span>
      <span>
        <span className="block text-[13px] font-bold">{title}</span>
        <span className="mt-0.5 block text-[10px] text-muted">{sub}</span>
      </span>
    </button>
  );

  return (
    <>
      <form className="mb-5 flex flex-col gap-3.5" onSubmit={handleSubmit} noValidate>
        <Field label="Email">
          <Input
            type="email"
            placeholder="you@email.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field label="Password">
          <Input
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        <Field label="Login as">
          <div className="flex gap-2">
            {roleOpt("owner", "🎛️", "Owner", "Full access — gigs, earnings, settings")}
            {roleOpt("helper", "🤝", "Helper", "Queue only — no financials")}
          </div>
        </Field>

        {error && <p className="text-center text-xs text-neon-2">{error}</p>}

        <button
          type="submit"
          className="mt-1 w-full cursor-pointer rounded-[10px] bg-gradient-to-br from-neon-3 to-[#ff8800] px-4 py-[15px] font-display text-[18px] tracking-[2px] text-bg shadow-[0_0_20px_rgba(255,230,0,0.2)] transition active:scale-[0.99]"
        >
          LOG IN TO DASHBOARD →
        </button>

        <button
          type="button"
          className="cursor-pointer border-none bg-transparent text-center text-xs text-muted underline hover:text-neon-3"
          onClick={() => show("Password reset sent! (demo)")}
        >
          Forgot password?
        </button>
      </form>

      {toastNode}
    </>
  );
}