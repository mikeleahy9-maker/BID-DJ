/**
 * Environment variable validation for BidaBeat.
 * Validates required environment variables at runtime (not build time).
 * Do not expose server-only secrets through NEXT_PUBLIC_*.
 */

const requiredEnvVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

let hasValidated = false;

/**
 * Validates that all required environment variables are set.
 * Throws an error if any required variable is missing.
 * Called at runtime, not at build time.
 */
export function validateEnv(): void {
  if (hasValidated) return;
  hasValidated = true;

  const missingVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );

  if (missingVars.length > 0) {
    console.warn(
      `Warning: Missing environment variables: ${missingVars.join(", ")}\n` +
        `Please set these in your environment or .env.local file. See .env.example for reference.`
    );
  }
}

/**
 * Safely get a required environment variable.
 * Use this for accessing environment variables in server code.
 * For NEXT_PUBLIC_* variables, they should be set in Vercel Environment Variables.
 */
export function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    const errorMsg = key.startsWith('NEXT_PUBLIC_')
      ? `${key} is not set. Set it in Vercel Dashboard → Settings → Environment Variables`
      : `${key} is not set. Please set it in your environment or .env.local file.`;
    throw new Error(errorMsg);
  }
  return value;
}

/**
 * Environment variables that are safe to use in the browser.
 * Only variables prefixed with NEXT_PUBLIC_ should be here.
 */
export const PUBLIC_ENV = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
} as const;