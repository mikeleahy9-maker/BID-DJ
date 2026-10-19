/**
 * Terms of Service page.
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
  title: "Terms of Service — BidaBeat",
  description: "BidaBeat Terms of Service. Read the terms that govern your use of the platform.",
};

export default function TermsPage() {
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
              Terms of Service
            </h1>
            <p className="mt-1 text-[11px] text-muted sm:text-sm">
              Last updated October 2026
            </p>
          </div>

          <div className="w-full max-w-2xl space-y-8 md:max-w-3xl md:space-y-10 lg:max-w-4xl">
          {p(
            "Welcome to BidaBeat. These Terms of Service (\"Terms\") govern your use of the BidaBeat platform, website, and mobile experience (the \"Service\"). By accessing or using the Service, you agree to these Terms. If you do not agree, you may not use the Service."
          )}

          {h("1. Eligibility")}
          {p(
            "You must be at least 13 years old to use the Service. If you are creating a DJ or Organizer account, you must be of legal age to enter into binding contracts in your jurisdiction."
          )}

          {h("2. Accounts")}
          {p(
            "You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. DJ and Guest accounts require email verification before full access."
          )}

          {h("3. Guest Bidding & Payments")}
          {p(
            "Guests purchase credits to request songs and bid them up the queue. Credits are $1.00 each plus any applicable bonus credits on larger packs. Purchases are processed through Stripe and are final once the credits are granted to your account. Unused credits at the end of an event are automatically donated to the event organizer and are not refunded."
          )}

          {h("4. DJ & Organizer Earnings")}
          {p(
            "DJs earn a share of event revenue plus guest tips. Event Organizers receive their share of non-DJ revenue. Payouts are handled automatically via Stripe and arrive 7–8 business days after an event ends. Stripe Express onboarding is required before payouts are enabled."
          )}

          {h("5. Prohibited Conduct")}
          {p(
            "You may not use the Service to: (a) violate any law; (b) impersonate another person or entity; (c) manipulate bids or queue outcomes through automated means; or (d) interfere with the Service or other users' events."
          )}

          {h("6. Intellectual Property")}
          {p(
            "BidaBeat and its logo, branding, and platform technology are owned by BidaBeat. You retain ownership of content you submit, but grant BidaBeat a license to host and display it as part of the Service."
          )}

          {h("7. Termination")}
          {p(
            "We may suspend or terminate your account at any time, without notice, for conduct we believe violates these Terms or is harmful to other users. Upon termination, your right to use the Service ends immediately."
          )}

          {h("8. Limitation of Liability")}
          {p(
            "To the fullest extent permitted by law, BidaBeat is not liable for any indirect, incidental, or consequential damages arising out of your use of the Service, including event cancellations, queue disputes, or payout delays."
          )}

          {h("9. Changes to These Terms")}
          {p(
            "We may update these Terms from time to time. We will notify you of material changes by posting the updated Terms on this page with a revised \"Last updated\" date. Your continued use constitutes acceptance."
          )}

          {h("10. Governing Law")}
          {p(
            "These Terms are governed by the laws of the jurisdiction in which BidaBeat operates, without regard to conflict-of-law principles."
          )}

          {p(
            <React.Fragment key="terms-contact">
              Questions about these Terms? Contact us at{" "}
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
