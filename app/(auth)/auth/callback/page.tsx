import { Suspense } from "react";
import AuthCallback from "@/features/auth/components/auth-callback";

export const metadata = { title: "Email Confirmation" };

export default function AuthCallbackPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-bg">
      <Suspense>
        <AuthCallback />
      </Suspense>
    </div>
  );
}