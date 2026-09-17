"use client";

import { FormEvent, useState } from "react";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "./use-toast";

/**
 * Guest login form — faithful port of screen-login from the prototype.
 * Auth wiring will be added when Supabase is connected.
 */

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { show, toastNode } = useToast();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    setError(null);
    show("✓ Logged in! (Supabase auth — coming soon)");
  };

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

        {error && <p className="text-center text-xs text-neon-2">{error}</p>}

        <button
          type="submit"
          className="mt-1 w-full cursor-pointer rounded-[10px] bg-gradient-to-br from-neon to-[#00c9b1] px-4 py-[15px] font-display text-[18px] tracking-[2px] text-bg shadow-[0_0_20px_rgba(0,255,225,0.2)] transition active:scale-[0.99]"
        >
          LOG IN →
        </button>

        <button
          type="button"
          className="cursor-pointer border-none bg-transparent text-center text-xs text-muted underline hover:text-neon"
          onClick={() => show("Password reset email sent! (demo)")}
        >
          Forgot password?
        </button>
      </form>

      {toastNode}
    </>
  );
}