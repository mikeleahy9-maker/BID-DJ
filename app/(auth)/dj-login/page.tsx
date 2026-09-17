import Link from "next/link";
import { AuthScreen } from "@/features/auth/components/auth-screen";
import DJLoginForm from "@/features/auth/components/dj-login-form";

export const metadata = { title: "DJ / Band Login" };

export default function DJLoginPage() {
  return (
    <AuthScreen title="DJ / Band Login" subtitle="Log in to manage your gigs and earnings">
      <DJLoginForm />
      <div className="my-5 h-px bg-edge" />
      <p className="text-center text-[13px] leading-[1.6] text-muted">
        New to BidaBeat as a DJ or Band?
        <br />
        <Link href="/dj-signup" className="font-bold text-neon-3 underline">
          Create a DJ/Band account — $50 one-time →
        </Link>
      </p>
    </AuthScreen>
  );
}