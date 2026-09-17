import { AuthScreen } from "@/features/auth/components/auth-screen";
import DJSignupForm from "@/features/auth/components/dj-signup-form";

export const metadata = { title: "Create DJ/Band Account" };

export default function DJSignupPage() {
  return (
    <AuthScreen
      backHref="/dj-login"
      title="Create DJ/Band Account"
      subtitle="One-time $50 activation fee — your account, your events, forever"
    >
      <DJSignupForm />
    </AuthScreen>
  );
}