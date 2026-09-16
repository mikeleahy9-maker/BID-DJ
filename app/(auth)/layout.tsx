/**
 * Authentication route group layout.
 * Used for login, signup, and password reset pages.
 */

import React from "react";
import { Logo } from "@/components/shared/logo";

interface LayoutProps {
  children: React.ReactNode;
}

export const metadata = {
  title: "BidaBeat - Sign In",
  description: "Sign in to your BidaBeat account",
};

export default function AuthLayout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Logo size="md" />
        </div>
        {children}
      </div>
    </div>
  );
}
