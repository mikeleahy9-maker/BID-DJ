import Link from "next/link";
import { AuthScreen } from "@/features/auth/components/auth-screen";
import SignupForm from "@/features/auth/components/signup-form";

export const metadata = { title: "Create Account" };

export default function SignupPage() {
  return (
    <AuthScreen title="Create Account" subtitle="Save your card once — use at any event">
      <SignupForm />
      <p className="text-center text-[13px] text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-neon underline">
          Log in →
        </Link>
      </p>
    </AuthScreen>
  );
}