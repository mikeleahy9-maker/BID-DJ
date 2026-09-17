import Link from "next/link";
import { AuthScreen } from "@/features/auth/components/auth-screen";
import LoginForm from "@/features/auth/components/login-form";

export const metadata = { title: "Log In" };

export default function LoginPage() {
  return (
    <AuthScreen title="Welcome Back" subtitle="Log in — then find tonight's event">
      <LoginForm />
      <p className="text-center text-[13px] text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold text-neon underline">
          Create one →
        </Link>
      </p>
    </AuthScreen>
  );
}