/**
 * Authentication route group layout.
 * Auth pages render their own shell (AuthScreen). This layout only
 * provides the scroll container inside the app frame.
 */

import React from "react";

interface LayoutProps {
  children: React.ReactNode;
}

export const metadata = {
  title: "BidaBeat — Sign In",
  description: "Sign in to your BidaBeat account",
};

export default function AuthLayout({ children }: LayoutProps) {
  return <main className="min-h-screen flex-1">{children}</main>;
}