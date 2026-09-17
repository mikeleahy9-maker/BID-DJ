import Link from "next/link";
import { AuthScreen } from "@/features/auth/components/auth-screen";
import GuestAuthForm from "@/features/auth/components/guest-auth-form";

export const metadata = { title: "Join as Guest" };

export default function GuestAuthPage() {
  return (
    <AuthScreen
      title="Join as Guest"
      subtitle="Add your card once — use it at any event tonight"
    >
      <GuestAuthForm />
      <p className="text-center text-[13px] text-muted">
        Want to save your history?{" "}
        <Link href="/signup" className="font-semibold text-neon underline">
          Create a free account →
        </Link>
      </p>
    </AuthScreen>
  );
}