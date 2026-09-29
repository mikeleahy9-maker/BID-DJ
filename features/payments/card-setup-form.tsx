"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import type {
  Stripe,
  StripeElements,
  StripePaymentElement,
  StripeAddressElement,
} from "@stripe/stripe-js";
import { STRIPE_APPEARANCE, STRIPE_PK } from "@/lib/stripe-client";

interface CardSetupFormProps {
  clientSecret: string | null;
  /**
   * The absolute URL the browser should land on if Stripe forces a
   * redirect-based auth. Optional — inferred from `window.location.origin`
   * at submit time (client-only), so it's safe during SSR.
   */
  returnUrl?: string;
  submitLabel?: string;
  footer?: string;
  /**
   * Classes for the container around the Stripe element. Defaults to a
   * bordered box; pass a minimal string (e.g. "") to embed the element
   * directly in a form card so it doesn't look like nested boxes.
   */
  elementClassName?: string;
  /**
   * Collect a billing address alongside the card. Required for India-registered
   * Stripe accounts: charging a non-India-issued card is an export transaction,
   * and modest Indian regulations force with the charge: the customer's name,
   * a billing address with a 2-letter ISO country, and a description. The
   * address is attached to the saved PaymentMethod on confirm so off-session
   * charges pass Stripe's export checks automatically.
   */
  collectBillingDetails?: boolean;
  /** Prefill the billing "name" field (known at signup, empty on re-save). */
  defaultBillingName?: string;
  onSaved: (result: {
    setupIntentId: string;
    billing: {
      name: string;
      line1: string;
      line2: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    } | null;
  }) => Promise<void> | void;
}

/**
 * Reusable Stripe card-save form ("Your card" step).
 * Mounts the Payment Element for a SetupIntent and confirms it. On success
 * calls `onSaved({ setupIntentId })` — the caller owns what happens next
 * (redirect, confirm server-side, refresh, etc.).
 */
export function CardSetupForm({
  clientSecret,
  returnUrl,
  submitLabel = "SAVE CARD →",
  footer,
  elementClassName = "rounded-lg border border-edge bg-surface-2 px-[14px] py-[11px]",
  collectBillingDetails = false,
  defaultBillingName = "",
  onSaved,
}: CardSetupFormProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const billingContainerRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const paymentElementRef = useRef<StripePaymentElement | null>(null);
  const billingAddressElementRef = useRef<StripeAddressElement | null>(null);
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      setReady(false);
      setCardError(null);
      try {
        if (!STRIPE_PK) {
          setCardError("Stripe isn't configured. Please try again later.");
          return;
        }
        if (!clientSecret) {
          setCardError("Couldn't start the payment form. Please try again.");
          return;
        }
        const stripe = await loadStripe(STRIPE_PK);
        if (!stripe || cancelled) return;
        const elements = stripe.elements({
          clientSecret,
          appearance: STRIPE_APPEARANCE,
        });

        if (collectBillingDetails && billingContainerRef.current) {
          const billingElement = elements.create("address", {
            mode: "billing",
            fields: {
              // Name and country are the fields Indian export rules require.
              name: "auto",
            },
            defaultValues: {
              name: defaultBillingName,
            },
          });
          if (billingContainerRef.current) {
            billingElement.mount(billingContainerRef.current);
          }
          billingAddressElementRef.current = billingElement;
        }

        const paymentElement = elements.create("payment");
        stripeRef.current = stripe;
        elementsRef.current = elements;
        paymentElementRef.current = paymentElement;
        if (containerRef.current) {
          paymentElement.mount(containerRef.current);
        }
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) {
          setCardError("Couldn't load the payment form. Please try again.");
        }
      }
    }

    setup();

    return () => {
      cancelled = true;
      if (paymentElementRef.current) {
        paymentElementRef.current.destroy();
        paymentElementRef.current = null;
      }
      if (billingAddressElementRef.current) {
        billingAddressElementRef.current.destroy();
        billingAddressElementRef.current = null;
      }
      elementsRef.current = null;
      stripeRef.current = null;
    };
  }, [clientSecret, attempt, collectBillingDetails, defaultBillingName]);

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault();
    const stripe = stripeRef.current;
    const elements = elementsRef.current;
    if (!stripe || !elements) return;
    setProcessing(true);
    setCardError(null);
    try {
      const result = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
        confirmParams: {
          return_url: returnUrl || window.location.origin,
        },
      });
      if (result.error) {
        setCardError(
          result.error.message ?? "We couldn't save your card. Please try again."
        );
        setAttempt((a) => a + 1);
      } else {
        const setupIntentId = result.setupIntent?.id ?? "";
        const billing = await getBillingFromElement();
        await onSaved({ setupIntentId, billing });
      }
    } catch (err) {
      setCardError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setProcessing(false);
    }
  };

  const getBillingFromElement = async () => {
    const addressElement = billingAddressElementRef.current;
    if (!addressElement) return null;
    try {
      const { complete, value } = await addressElement.getValue();
      if (!complete || !value) return null;
      const name = value.name ?? "";
      const a = value.address ?? {};
      return {
        name,
        line1: a.line1 ?? "",
        line2: a.line2 ?? "",
        city: a.city ?? "",
        state: a.state ?? "",
        postalCode: a.postal_code ?? "",
        country: a.country ?? "",
      };
    } catch {
      return null;
    }
  };

  return (
    <form className="mb-3.5 flex flex-col gap-3.5" onSubmit={handleConfirm} noValidate>
      {collectBillingDetails && (
        <>
          <div className="my-1 flex items-center gap-3">
            <span className="h-px flex-1 bg-edge" />
            <span className="text-[11px] uppercase tracking-[1px] text-muted">
              Billing address
            </span>
            <span className="h-px flex-1 bg-edge" />
          </div>

          <div
            ref={billingContainerRef}
            className={elementClassName}
          />
        </>
      )}

      <div className="my-1 flex items-center gap-3">
        <span className="h-px flex-1 bg-edge" />
        <span className="text-[11px] uppercase tracking-[1px] text-muted">
          Your card
        </span>
        <span className="h-px flex-1 bg-edge" />
      </div>

      <div
        ref={containerRef}
        className={elementClassName}
      />

      {cardError && <p className="text-center text-xs text-neon-2">{cardError}</p>}

      <button
        type="submit"
        disabled={!ready || processing}
        className="mt-1 w-full cursor-pointer rounded-[10px] bg-gradient-to-br from-neon to-[#00c9b1] px-4 py-[15px] font-display text-[18px] tracking-[2px] text-bg shadow-[0_0_20px_rgba(0,255,225,0.2)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {processing ? "SAVING…" : submitLabel}
      </button>

      {footer && (
        <p className="mt-2 text-center text-[10px] leading-[1.6] text-muted">
          {footer}
        </p>
      )}
    </form>
  );
}

export default CardSetupForm;