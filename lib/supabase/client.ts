/**
 * Supabase client for browser/client-side usage.
 * 
 * This client uses the NEXT_PUBLIC_SUPABASE_ANON_KEY which is safe to expose.
 * Do not use this client to access server-only operations.
 * For server-side operations, use the server client instead.
 * 
 * Docs: https://supabase.com/docs/guides/auth/auth-helpers/nextjs-ssr
 */

'use client';

import { createBrowserClient } from '@supabase/ssr';
import { PUBLIC_ENV } from '@/lib/env';

let supabase: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Get or create the Supabase browser client.
 * This should be used in client components only.
 */
export function getSupabaseClient() {
  if (!supabase) {
    supabase = createBrowserClient(
      PUBLIC_ENV.SUPABASE_URL!,
      PUBLIC_ENV.SUPABASE_ANON_KEY!
    );
  }
  return supabase;
}
