import Link from "next/link";

export const metadata = { title: "Organizer Setup" };

interface OrganizerOnboardingPageProps {
  searchParams: Promise<{ event?: string; organization?: string }>;
}

export default async function OrganizerOnboardingPage({
  searchParams,
}: OrganizerOnboardingPageProps) {
  const { event, organization } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6 py-16">
      <div className="w-full max-w-lg rounded-2xl border border-edge bg-surface p-8 text-center">
        <div className="text-[11px] uppercase tracking-[3px] text-muted">
          BidaBeat
        </div>
        <h1 className="mt-3 font-display text-4xl tracking-[2px] text-neon">
          You&apos;re all set
        </h1>

        <p className="mt-4 text-sm text-muted">
          {organization ? (
            <>
              Your payout account for <span className="text-foreground">{organization}</span> is
              set up.
            </>
          ) : (
            "Your payout account is set up."
          )}
        </p>

        {event && (
          <p className="mt-2 text-sm text-muted">
            Any money you earn from{" "}
            <span className="text-foreground">{event}</span> will be sent to the bank
            details you provided.
          </p>
        )}

        <p className="mt-6 text-sm text-muted">You can close this window.</p>

        <div className="mt-8 border-t border-edge pt-6 text-left">
          <p className="text-[11px] uppercase tracking-[1px] text-muted">
            Need to change something?
          </p>
          <p className="mt-1 text-sm text-muted">
            Reply to the DJ who invited you and they can send a fresh link to
            your Stripe dashboard, where you can update your bank details and
            payout schedule.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm font-semibold text-neon hover:underline"
          >
            Back to BidaBeat
          </Link>
        </div>
      </div>
    </main>
  );
}