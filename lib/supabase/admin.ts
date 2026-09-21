import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Admin (server-only) Supabase client.
 *
 * Bypasses RLS — used in trusted server contexts such as Stripe webhooks and
 * background jobs. NEVER import from a client component.
 *
 * Reads the service-role key from a server-only env var. Local dev also falls
 * back to the Supabase secret key present in .env.development.
 */
let admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and a service-role / secret key."
    );
  }

  if (!admin) {
    admin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return admin;
}