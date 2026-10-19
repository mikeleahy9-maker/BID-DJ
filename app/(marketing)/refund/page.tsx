/**
 * Refund / Cancellation Policy page.
 */

import React from "react";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";

const p = (...children: React.ReactNode[]) => (
  <p className="mb-5 text-[11px] leading-[1.7] text-muted sm:text-sm sm:leading-[1.9] md:mb-6">
    {children}
  </p>
);

const h = (text: string) => (
  <h3 className="mt-8 mb-3 font-display text-xl tracking-[1px] text-foreground md:mt-10 md:mb-4 md:text-2xl">
    {text}
  </h3>
);

export const metadata = {
  title: "Refund & Cancellation Policy — BidaBeat",
  description: "BidaBeat Refund and Cancellation Policy for credits, event bookings and payouts.",
};

export default function RefundPage() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(0,255,225,0.09),transparent_60%),radial-gradient(ellipse_at_80%_80%,rgba(255,45,120,0.07),transparent_50%)]"
      />

      <div className="relative z-[1] flex w-full flex-col items-center gap-[18px] px-4 pb-16 pt-12 sm:px-6 md:pb-20 md:pt-16 lg:pb-24 lg:pt-20">
        <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
          <Link
            href="/"
            aria-label="Close and go back to home"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-edge bg-surface/70 text-muted transition hover:border-neon hover:text-neon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <span aria-hidden>✕</span>
          </Link>
        </div>
        <div className="text-center">
            <Logo layout="stack" className="mb-2" />
            <h1 className="font-display text-[32px] tracking-[2px] text-neon md:text-[40px] lg:text-[48px]">
              Refund &amp; Cancellation Policy
            </h1>
            <p className="mt-1 text-[11px] text-muted sm:text-sm">
              Last updated October 2026
            </p>
          </div>

          <div className="w-full max-w-2xl space-y-8 md:max-w-3xl md:space-y-10 lg:max-w-4xl">
          {p(
            "This policy describes how refunds and cancellations work for credit purchases, event bookings, and payouts on BidaBeat."
          )}

          {h("1. Credit Purchases (Guests)")}
          {p(
            "Credit purchases are processed through Stripe and are final once credits are granted to your account. Credits are $1.00 each plus any applicable bonus credits on larger packs. We do not offer refunds for unused credits."
          )}

          {h("2. Unused Credits at Event Close")}
          {p(
            "Any credits you still hold when an event ends are automatically donated to the event organizer. They are not refunded to you and cannot be transferred to another event or account."
          )}

          {h("3. Song Refunds (Bid Returns)")}
          {p(
            "If a song you bid on is refunded by the DJ or removed from the queue, the credits you bid on that song are returned to your account balance. Only bids on the specific refunded song are credited back — bids on other songs are unaffected."
          )}

          {h("4. Event Cancellations (Organizers / DJs)")}
          {p(
            "If an event is cancelled before it goes live, the DJ may cancel the event from their dashboard. No platform fee is charged for cancelled draft events. If an event has already gone live, it cannot be cancelled through the Service — contact us and we will review on a case-by-case basis."
          )}

          {h("5. DJ / Organizer Payouts")}
          {p(
            "Payouts are handled automatically via Stripe Express and arrive 7–8 business days after an event ends. Payouts are not refundable once sent to your bank account. If a payout fails (e.g. invalid bank details), the funds return to the platform and we will contact you to correct them."
          )}

          {h("6. Chargebacks")}
          {p(
            "If you dispute a charge with your bank instead of contacting us first, your account may be suspended pending resolution. We encourage you to contact us at the address below before initiating a chargeback so we can resolve the issue directly."
          )}

          {h("7. How to Request a Refund or Cancellation")}
          {p(
            <React.Fragment key="refund-contact">
              To request a refund or cancel a booking, contact us at{" "}
              <Link
                href="mailto:support@bidabeat.com"
                className="text-neon hover:underline"
              >
                support@bidabeat.com
              </Link>
              . Include your account email, the event code (if any), the amount,
              and a description of the issue. We review requests within 5 business
              days.
            </React.Fragment>
          )}

          {h("8. Exceptions")}
          {p(
            "We may offer a refund or credit at our sole discretion where the Service failed (e.g. a charged purchase that never granted credits, or a double charge). Contact us and we will investigate."
          )}
        </div>

        <div className="mt-8 flex w-full flex-col items-center gap-2 border-t border-edge pt-4 text-center">
          <Link href="/" className="text-[11px] text-muted hover:text-neon transition">
            ← Back to Home
          </Link>
        </div>
      </div>
    </section>
  );
}
