"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";

type OtpType =
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "email"
  | "sms";

/**
 * AuthCallback — the email-confirmation page. Landed on from every Supabase
 * email link (signup confirmation, magic links, password recovery).
 *
 * How each link shape is handled:
 *  1. PKCE (?code=) — @supabase/ssr forces the PKCE flow, but the SDK ALREADY
 *     exchanges the code automatically during client init (the code_verifier
 *     lives in the browser's cookie and codes are single-use — exchanging
 *     a second time throws, so we never re-exchange here). It fires
 *     SIGNED_IN; this page just listens and routes. This only works in the
 *     browser that started the signup, because PKCE is bound to it.
 *  2. Implicit hash (#access_token + #refresh_token) — also auto-processed by
 *     the SDK; setSession below is the manual fallback.
 *  3. Auth-link token (?token_hash + ?type) — not auto-handled by the SDK, so
 *     we verify explicitly.
 *
 * On success the session is already stored (auto-login) and the user is
 * routed into the app: DJ / helper → /dj/events, everyone else → /dashboard.
 */
export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [message, setMessage] = useState("Confirming your email…");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialUrlRef = useRef<string>(
    typeof window !== "undefined" ? window.location.href : ""
  );

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseClient();

    const url = new URL(initialUrlRef.current, window.location.origin);
    const hash = new URLSearchParams(url.hash.slice(1));
    const search = url.searchParams;

    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const code = search.get("code");
    const tokenHash = search.get("token_hash");
    const type = search.get("type");

    const roleOf = (
      user?: { user_metadata?: Record<string, unknown> } | null
    ) => (user?.user_metadata?.role as string | undefined) ?? null;

    const routeIn = (user?: { user_metadata?: Record<string, unknown> } | null) => {
      if (cancelled) return;
      setMessage("Email confirmed — welcome to BidaBeat!");
      const target =
        roleOf(user) === "dj" || roleOf(user) === "helper"
          ? "/dj/events"
          : "/dashboard";
      timeoutRef.current = setTimeout(() => {
        if (!cancelled) router.replace(target);
      }, 900);
    };

    const fail = (err?: unknown) => {
      if (cancelled) return;
      const raw =
        err instanceof Error
          ? err.message
          : "This confirmation link is invalid or has expired.";
      setDetail(raw);
      if (/pkce|verifier|code_exchange|exchange|token|used|invalid grant/i.test(raw)) {
        setError(
          "This link could not be confirmed in this browser. Open it in the same browser you used to create your account — PKCE security links confirmation to that browser — or request a fresh link."
        );
      } else {
        setError(raw);
      }
    };

    // The SDK processes PKCE / implicit tokens during client init and fires
    // SIGNED_IN asynchronously. Subscribe BEFORE that notification lands so we
    // never miss it, and never re-exchange the (single-use) code ourselves.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === "SIGNED_IN" && session) routeIn(session.user);
    });

    (async () => {
      try {
        // Give the SDK's async init time to finish the auto exchange.
        await new Promise((resolve) => setTimeout(resolve, 600));
        if (cancelled) return;

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        if (session) return; // already routed via SIGNED_IN

        // Fallbacks for link shapes the SDK does NOT auto-process:
        if (accessToken && refreshToken) {
          const { data, error: sessionError } =
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          if (cancelled) return;
          if (sessionError) throw sessionError;
          if (data.session) {
            routeIn(data.session.user);
            return;
          }
          setError("This confirmation link is invalid or has expired.");
          return;
        }

        if (tokenHash && type) {
          const { data, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as OtpType,
          });
          if (cancelled) return;
          if (verifyError) throw verifyError;
          if (data.session) {
            routeIn(data.session.user);
            return;
          }
          setError("This confirmation link is invalid or has expired.");
          return;
        }

        // PKCE code still in the URL means the SDK skipped it (different
        // browser / missing verifier). Try once so we can surface a clear
        // error; a valid same-browser link never reaches this branch.
        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (cancelled) return;
          if (exchangeError) throw exchangeError;
        }

        setError("This confirmation link is invalid or has expired.");
      } catch (err) {
        fail(err);
      } finally {
        subscription.unsubscribe();
      }
    })();

    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [router]);

  return (
    <div className="flex w-full max-w-[420px] flex-col items-center justify-center px-6 text-center">
      <div className="w-full rounded-xl border border-edge bg-surface p-8">
        <div className="mb-3 text-[32px]" aria-hidden>
          {error ? "⚠️" : "✅"}
        </div>
        {error ? (
          <>
            <h1 className="mb-2 font-display text-[20px] tracking-[1px] text-foreground">
              Confirmation failed
            </h1>
            <p className="mb-5 text-[13px] leading-[1.7] text-muted">{error}</p>
            {detail && detail !== error && (
              <p className="mb-5 break-words rounded-lg border border-edge bg-surface-2 px-3 py-2 text-left text-[11px] leading-[1.6] text-muted">
                {detail}
              </p>
            )}
            <button
              onClick={() => router.replace("/login")}
              className="w-full cursor-pointer rounded-[10px] bg-gradient-to-br from-neon to-[#00c9b1] px-4 py-[13px] font-display text-[16px] tracking-[2px] text-bg shadow-[0_0_20px_rgba(0,255,225,0.2)] transition active:scale-[0.99]"
            >
              GO TO LOGIN →
            </button>
          </>
        ) : (
          <>
            <h1 className="mb-2 font-display text-[20px] tracking-[1px] text-foreground">
              You&apos;re in!
            </h1>
            <p className="text-[13px] leading-[1.7] text-muted">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}