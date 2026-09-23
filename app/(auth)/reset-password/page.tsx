import Link from "next/link";
import { AuthScreen } from "@/features/auth/components/auth-screen";
import ResetPasswordForm from "@/features/auth/components/reset-password-form";

export const metadata = { title: "Reset Password" };

export default function ResetPasswordPage() {
  return (
    <AuthScreen
      title="Set a New Password"
      subtitle="Choose a new password for your account"
    >
      <ResetPasswordForm />
      <p className="text-center text-[13px] text-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-neon underline">
          Log in →
        </Link>
      </p>
    </AuthScreen>
  );
}