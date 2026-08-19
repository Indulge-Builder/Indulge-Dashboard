/**
 * lib/viewerGate.ts
 *
 * Passcode gate for VIEWING the dashboard (distinct from lib/settingsAuth.ts,
 * which guards /settings writes). Built for the public deployment at
 * dashboard.indulge.global: one shared passcode, typed once per device,
 * exchanged for a signed httpOnly cookie that lasts 30 days so the office TV
 * and staff phones rarely see the prompt.
 *
 * Deliberately OPT-IN, unlike the fail-closed settings PIN:
 *   - DASHBOARD_PIN unset → gate OFF everywhere (today's TV deployment keeps
 *     working the moment this ships; nothing to configure).
 *   - DASHBOARD_PIN set   → every visit needs the cookie.
 *
 * Cookie format mirrors settingsAuth: `<expiryMs>.<hmac>`, HMAC-signed with
 * DASHBOARD_PIN + the service-role key, so forging needs both secrets and the
 * expiry cannot be extended client-side.
 *
 * Future: when viewing moves to Supabase Auth (shared with the Subscription
 * Manager project), swap `hasViewerSession` for a session check against that
 * project's JWT and delete the PIN path — the call sites in app/page.tsx and
 * app/api/viewer-session/route.ts are the only two.
 */

import { createHmac, timingSafeEqual } from "crypto";

export const VIEWER_COOKIE = "indulge_viewer";

/** One passcode entry lasts this long per device. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function configuredPin(): string | null {
  const pin = process.env.DASHBOARD_PIN?.trim();
  return pin && pin.length >= 4 ? pin : null;
}

/** Gate is active only when a passcode is configured. */
export function isViewerGateEnabled(): boolean {
  return configuredPin() !== null;
}

function signingKey(): string {
  // Both secrets required to forge a token; service key alone can't mint one
  // without knowing the PIN, and vice versa.
  return `${configuredPin() ?? ""}:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`;
}

function sign(payload: string): string {
  return createHmac("sha256", signingKey()).update(payload).digest("hex");
}

export function mintViewerToken(): string {
  const expiry = String(Date.now() + SESSION_TTL_MS);
  return `${expiry}.${sign(expiry)}`;
}

export function isValidViewerToken(token: string | undefined): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expiry = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(expiry);
  const a = Buffer.from(mac, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  if (!timingSafeEqual(a, b)) return false;
  return Number(expiry) > Date.now();
}

export function isCorrectPin(candidate: string): boolean {
  const pin = configuredPin();
  if (!pin) return false;
  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(pin, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const VIEWER_COOKIE_OPTIONS = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: Math.floor(SESSION_TTL_MS / 1000),
};
