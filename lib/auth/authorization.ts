/**
 * Authorization utilities for BidaBeat.
 * 
 * This module provides reusable server-side authorization helpers.
 * These functions should only be used in Server Components and Route Handlers.
 * 
 * Authorization is enforced at three levels:
 * 1. Browser/UI - navigation visibility (UX only, not security)
 * 2. Next.js server - route protection and operation authorization
 * 3. Supabase - PostgreSQL RLS policies (final enforcement)
 */

import { getCurrentUser } from "@/lib/supabase/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type AppRole = "guest" | "dj_owner" | "dj_helper";

/**
 * User session data with application role information.
 */
export interface AuthUser {
  id: string;
  email: string;
  role: AppRole | null;
}

/**
 * Get the current user with their application role.
 * Returns null if the user is not authenticated.
 * 
 * This should be called in Server Components and Route Handlers only.
 */
export async function getCurrentAuthUser(): Promise<AuthUser | null> {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  // Get the user's profile with their role
  const supabase = await getSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return {
      id: user.id,
      email: user.email || "",
      role: null,
    };
  }

  return {
    id: profile.id,
    email: profile.email,
    role: (profile.role as AppRole) || null,
  };
}

/**
 * Check if a user has a specific role.
 * Returns false if the user is not authenticated or doesn't have the role.
 */
export async function hasRole(role: AppRole): Promise<boolean> {
  const user = await getCurrentAuthUser();
  return user?.role === role || false;
}

/**
 * Check if a user has any of the specified roles.
 * Returns false if the user is not authenticated.
 */
export async function hasAnyRole(roles: AppRole[]): Promise<boolean> {
  const user = await getCurrentAuthUser();
  if (!user || !user.role) {
    return false;
  }
  return roles.includes(user.role as AppRole);
}

/**
 * Require authentication.
 * Throws an error if the user is not authenticated.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentAuthUser();
  if (!user) {
    throw new Error("Unauthorized: User must be authenticated");
  }
  return user;
}

/**
 * Require a specific role.
 * Throws an error if the user doesn't have the required role.
 */
export async function requireRole(role: AppRole): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role !== role) {
    throw new Error(`Unauthorized: User must have ${role} role`);
  }
  return user;
}

/**
 * Require any of the specified roles.
 * Throws an error if the user doesn't have any of the required roles.
 */
export async function requireAnyRole(roles: AppRole[]): Promise<AuthUser> {
  const user = await requireAuth();
  if (!user.role) {
    throw new Error(`Unauthorized: User must have one of: ${roles.join(", ")}`);
  }
  if (!roles.includes(user.role as AppRole)) {
    throw new Error(`Unauthorized: User must have one of: ${roles.join(", ")}`);
  }
  return user;
}

/**
 * Check if a user can access guest pages.
 * Guests can access guest-specific pages.
 */
export async function canAccessGuestPages(): Promise<boolean> {
  const user = await getCurrentAuthUser();
  return user?.role === "guest" || false;
}

/**
 * Check if a user can access DJ pages.
 * DJ owners and DJ helpers can access DJ pages.
 */
export async function canAccessDJPages(): Promise<boolean> {
  const user = await getCurrentAuthUser();
  return user?.role === "dj_owner" || user?.role === "dj_helper" || false;
}

/**
 * Check if a user can access financial/earnings pages.
 * Only DJ owners can access financial pages.
 */
export async function canAccessFinancialPages(): Promise<boolean> {
  const user = await getCurrentAuthUser();
  return user?.role === "dj_owner" || false;
}

/**
 * Check if a user can manage queue operations.
 * DJ owners and DJ helpers can manage queues.
 */
export async function canManageQueue(): Promise<boolean> {
  const user = await getCurrentAuthUser();
  return user?.role === "dj_owner" || user?.role === "dj_helper" || false;
}
