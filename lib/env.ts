/**
 * Environment variable validation for BidaBeat.
 * Validates required environment variables at application startup.
 * Do not expose server-only secrets through NEXT_PUBLIC_*.
 */

const requiredEnvVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

/**
 * Validates that all required environment variables are set.
 * Throws an error if any required variable is missing.
 */
export function validateEnv(): void {
  const missingVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}\n` +
        `Please check your .env.local file. See .env.example for reference.`
    );
  }
}

/**
 * Safely get a required environment variable.
 * Use this for accessing environment variables in server code.
 */
export function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is not set`);
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

/**
 * Validate environment variables when the module is loaded.
 * This runs at build time and startup.
 */
if (typeof window === "undefined") {
  // Only validate on the server
  try {
    validateEnv();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
