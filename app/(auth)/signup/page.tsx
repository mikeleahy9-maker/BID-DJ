import Link from "next/link";
import { AuthScreen } from "@/features/auth/components/auth-screen";
import SignupForm from "@/features/auth/components/signup-form";
import { getGuestDeepLink, guestDeepLinkQuery } from "@/lib/auth-redirect";

export const metadata = { title: "Create Account" };

interface SignupPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const next = getGuestDeepLink((await searchParams).next);
  const nextQuery = guestDeepLinkQuery(next);

  return (
    <AuthScreen title="Create Account" subtitle="Save your card once — use at any event">
      <SignupForm next={next} />
      <p className="text-center text-[13px] text-muted">
        Already have an account?{" "}
        <Link href={`/login${nextQuery}`} className="font-semibold text-neon underline">
          Log in →
        </Link>
      </p>
    </AuthScreen>
  );
}