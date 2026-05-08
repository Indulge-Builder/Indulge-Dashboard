/**
 * lib/env.ts
 *
 * Server-side startup validation. Call assertServerEnv() early in any
 * server module that requires DB access so misconfiguration fails fast
 * with a clear message rather than a 503 at request time.
 */

const REQUIRED_SERVER_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export function assertServerEnv(): void {
  const missing = REQUIRED_SERVER_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(
      `[STARTUP] Missing required environment variables: ${missing.join(", ")}`,
    );
  }
}
