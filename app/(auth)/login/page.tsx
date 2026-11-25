import Link from "next/link";
import { AuthScreen } from "@/features/auth/components/auth-screen";
import LoginForm from "@/features/auth/components/login-form";
import { getGuestDeepLink, guestDeepLinkQuery } from "@/lib/auth-redirect";

export const metadata = { title: "Log In" };

interface LoginPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const next = getGuestDeepLink((await searchParams).next);
  const nextQuery = guestDeepLinkQuery(next);

  return (
    <AuthScreen title="Welcome Back" subtitle="Log in — then find tonight's event">
      <LoginForm next={next} />
      <p className="text-center text-[13px] text-muted">
        Don&apos;t have an account?{" "}
        <Link href={`/signup${nextQuery}`} className="font-semibold text-neon underline">
          Create one →
        </Link>
      </p>
    </AuthScreen>
  );
}