"use client";

import { useEffect, useState } from "react";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import {
  ConnectBalances,
  ConnectComponentsProvider,
  ConnectPayoutsList,
} from "@stripe/react-connect-js";
import { useToast } from "@/components/ui/use-toast";

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

interface ConnectStatus {
  hasAccount: boolean;
  connected: boolean;
}

async function fetchClientSecret(): Promise<string> {
  const res = await fetch("/api/dj/stripe/session", { method: "POST" });
  const json = await res.json();
  if (!res.ok || !json.client_secret) {
    throw new Error(json.error ?? "Could not start a Stripe session.");
  }
  return json.client_secret as string;
}

export default function StripeConnectEmbedded() {
  const { show, toastNode } = useToast();
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [instance, setInstance] = useState<ReturnType<typeof loadConnectAndInitialize> | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dj/connect/status")
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) {
          setTimeout(
            () => setStatus({ hasAccount: !!json.hasAccount, connected: !!json.connected }),
            0
          );
        }
      })
      .catch(() => {
        if (!cancelled) setTimeout(() => setError("Could not check your Stripe account."), 0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!status?.hasAccount || !PUBLISHABLE_KEY) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      try {
        const connect = loadConnectAndInitialize({
          publishableKey: PUBLISHABLE_KEY,
          fetchClientSecret,
          appearance: {
            variables: {
              colorPrimary: "#00e5b0",
              colorBackground: "#0d0d0f",
              borderRadius: "12px",
            },
          },
        });
        if (!cancelled) setInstance(connect);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load Stripe.");
        }
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [status]);

  const startConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch("/api/dj/connect", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? "Could not start Stripe onboarding.");
      }
      window.location.href = json.url;
    } catch (err) {
      show(err instanceof Error ? err.message : "Could not start Stripe onboarding.");
      setConnecting(false);
    }
  };

  const message = !PUBLISHABLE_KEY ? "Stripe is not configured." : error;

  if (message) {
    return (
      <>
        <div className="rounded-xl border border-edge bg-surface px-4 py-6 text-center text-sm text-muted">
          {message}
        </div>
        {toastNode}
      </>
    );
  }

  if (!status) {
    return (
      <div className="rounded-xl border border-edge bg-surface p-5">
        <div className="h-6 w-1/3 animate-pulse rounded bg-surface-2" />
        <div className="mt-4 h-32 animate-pulse rounded bg-surface-2" />
      </div>
    );
  }

  if (!status.hasAccount) {
    return (
      <>
        <div className="rounded-xl border border-edge bg-surface p-5">
          <h3 className="font-semibold text-neon">Connect your Stripe account</h3>
          <p className="mt-1 text-sm text-muted">
            Create a Stripe account to view your available balance, track upcoming payouts, and
            get paid. It takes about 5 minutes.
          </p>
          <button
            onClick={startConnect}
            disabled={connecting}
            className="mt-4 w-full rounded-xl bg-gradient-to-br from-neon to-[#00c9b1] px-5 py-3 font-display text-lg tracking-[2px] text-bg transition active:scale-[0.99] disabled:opacity-60 sm:w-auto"
          >
            {connecting ? "Opening Stripe…" : "Connect with Stripe →"}
          </button>
        </div>
        {toastNode}
      </>
    );
  }

  if (!status.connected) {
    return (
      <>
        <div className="rounded-xl border border-edge bg-surface p-5">
          <h3 className="font-semibold text-neon">Finish setting up payouts</h3>
          <p className="mt-1 text-sm text-muted">
            Stripe still needs your bank details before balances and payouts can be shown here.
          </p>
          <button
            onClick={startConnect}
            disabled={connecting}
            className="mt-4 w-full rounded-xl bg-gradient-to-br from-neon to-[#00c9b1] px-5 py-3 font-display text-lg tracking-[2px] text-bg transition active:scale-[0.99] disabled:opacity-60 sm:w-auto"
          >
            {connecting ? "Opening Stripe…" : "Complete setup →"}
          </button>
        </div>
        {toastNode}
      </>
    );
  }

  if (!instance) {
    return (
      <div className="rounded-xl border border-edge bg-surface p-5">
        <div className="h-6 w-1/3 animate-pulse rounded bg-surface-2" />
        <div className="mt-4 h-32 animate-pulse rounded bg-surface-2" />
      </div>
    );
  }

  return (
    <ConnectComponentsProvider connectInstance={instance}>
      <div className="space-y-6">
        <ConnectBalances />
        <ConnectPayoutsList />
      </div>
    </ConnectComponentsProvider>
  );
}