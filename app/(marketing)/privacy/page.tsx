/**
 * Privacy Policy page.
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
  title: "Privacy Policy — BidaBeat",
  description: "BidaBeat Privacy Policy. Learn how we collect, use and protect your personal information.",
};

export default function PrivacyPage() {
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
              Privacy Policy
            </h1>
            <p className="mt-1 text-[11px] text-muted sm:text-sm">
              Last updated October 2026
            </p>
          </div>

          <div className="w-full max-w-2xl space-y-8 md:max-w-3xl md:space-y-10 lg:max-w-4xl">
          {p(
            "This Privacy Policy explains how BidaBeat (\u201cwe\u201d, \u201cus\u201d, or \u201cBidaBeat\u201d) collects, uses, and protects your personal information when you use our Service. Please read it carefully."
          )}

          {h("1. Information We Collect")}
          {p(
            "We collect information you provide directly, such as your name, email address, phone number, act/stage name, city, bio, profile photo, and Stripe Connect onboarding details (for DJs and Organizers). Guests may also provide payment card details, which are tokenized by Stripe and not stored on our servers."
          )}

          {h("2. How We Use Your Information")}
          {p(
            "We use your information to: create and manage your account; run events and queues; process credit purchases and payouts via Stripe; send account-related emails (confirmations, receipts, payout notices); and improve the Service."
          )}

          {h("3. Information We Share")}
          {p(
            "We do not sell your personal information. We share data only with: (a) Stripe, for payment processing and payouts; (b) event hosts/DJs you interact with, limited to what's needed to run an event (e.g. your name on a bid); and (c) law enforcement when legally required."
          )}

          {h("4. Cookies & Tracking")}
          {p(
            "We use cookies and similar technologies to keep you signed in, remember preferences, and analyze usage. You can disable cookies in your browser, though some Service features may not work without them."
          )}

          {h("5. Data Retention")}
          {p(
            "We retain your personal information only as long as necessary to fulfill the purposes described here, including for legal, tax, and accounting obligations. You may request account deletion at any time."
          )}

          {h("6. Your Rights")}
          {p(
            "Depending on your location, you may have the right to access, correct, delete, or export your personal information, and to object to certain processing. To exercise these rights, contact us at the address below."
          )}

          {h("7. Security")}
          {p(
            "We use industry-standard safeguards (encryption in transit and at rest, access controls) to protect your information. No transmission over the internet is 100% secure, and we cannot guarantee absolute security."
          )}

          {h("8. Children")}
          {p(
            "The Service is not directed to children under 13. We do not knowingly collect personal information from children under 13. If we learn we have collected such information, we will delete it."
          )}

          {h("9. Changes to This Policy")}
          {p(
            "We may update this Privacy Policy. We will post the updated version here with a revised \"Last updated\" date. Your continued use constitutes acceptance."
          )}

          {h("10. Contact Us")}
          {p(
            <React.Fragment key="privacy-contact">
              Questions or requests about this Privacy Policy or your data? Contact us at{" "}
              <Link
                href="mailto:privacy@bidabeat.com"
                className="text-neon hover:underline"
              >
                privacy@bidabeat.com
              </Link>
              , or{" "}
              <Link
                href="mailto:support@bidabeat.com"
                className="text-neon hover:underline"
              >
                support@bidabeat.com
              </Link>
              .
            </React.Fragment>
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
