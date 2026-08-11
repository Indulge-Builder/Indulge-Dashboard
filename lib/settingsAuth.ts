/**
 * lib/settingsAuth.ts
 *
 * PIN gate for /settings and every mutating /api/settings/* route.
 *
 * The TV dashboard itself has no auth and never will — it is a read-only
 * fullscreen display. The Settings page can rewrite the roster and insert
 * client rows, so it gets its own lock: one shared PIN (`SETTINGS_PIN`) that
 * non-technical staff type once, exchanged for a signed, httpOnly cookie.
 *
 * Behaviour mirrors lib/webhookAuth.ts:
 *   - Production: SETTINGS_PIN unset → fail CLOSED (nobody gets in).
 *   - Development: SETTINGS_PIN unset → fail OPEN with a warning, so `npm run
 *     dev` works without extra setup.
 *
 * The cookie is `<expiryMs>.<hmac>`, signed with SETTINGS_PIN + the service
 * role key. Forging one therefore needs both secrets, and the expiry is inside
 * the signed payload so it cannot be extended client-side.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabaseAdmin";

export const SETTINGS_COOKIE = "indulge_settings";

/** How long one PIN entry lasts before it must be typed again. */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** Minimum PIN length enforced at configuration time, not at the prompt. */
const MIN_PIN_LENGTH = 4;

function constantTimeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function configuredPin(): string | null {
  const pin = (process.env.SETTINGS_PIN ?? "").trim();
  if (!pin) return null;
  if (pin.length < MIN_PIN_LENGTH) {
    console.error(
      `[settingsAuth] SETTINGS_PIN is shorter than ${MIN_PIN_LENGTH} characters — refusing to use it.`,
    );
    return null;
  }
  return pin;
}

/**
 * True when no usable PIN is configured AND we are outside production — the
 * dev-convenience bypass. In production this is always false, so a missing PIN
 * locks the page rather than opening it.
 */
function isDevBypass(): boolean {
  if (configuredPin()) return false;
  if (process.env.NODE_ENV === "production") return false;
  console.warn(
    "[settingsAuth] SETTINGS_PIN not set — /settings is UNLOCKED (dev only). " +
      "Set SETTINGS_PIN in .env.local before deploying.",
  );
  return true;
}

function signingKey(pin: string): string {
  return `${pin}::${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`;
}

function sign(expiryMs: number, pin: string): string {
  return createHmac("sha256", signingKey(pin))
    .update(String(expiryMs))
    .digest("hex");
}

/** Issues a fresh session token. Returns null when no PIN is configured. */
export function mintSessionToken(): string | null {
  const pin = configuredPin();
  if (!pin) return null;
  const expiry = Date.now() + SESSION_TTL_MS;
  return `${expiry}.${sign(expiry, pin)}`;
}

function isValidToken(token: string | undefined): boolean {
  const pin = configuredPin();
  if (!pin || !token) return false;

  const [expiryRaw, signature] = token.split(".");
  const expiry = Number(expiryRaw);
  if (!signature || !Number.isFinite(expiry)) return false;
  if (expiry <= Date.now()) return false;

  return constantTimeEqual(signature, sign(expiry, pin));
}

/** Verifies a PIN submitted from the unlock form. */
export function pinMatches(candidate: unknown): boolean {
  const pin = configuredPin();
  if (!pin || typeof candidate !== "string") return false;
  return constantTimeEqual(candidate.trim(), pin);
}

/** True when the caller already holds a valid session (or dev bypass applies). */
export function hasSettingsSession(req: NextRequest): boolean {
  if (isDevBypass()) return true;
  return isValidToken(req.cookies.get(SETTINGS_COOKIE)?.value);
}

/** Whether a PIN is configured at all — the UI skips the prompt if not. */
export function isPinConfigured(): boolean {
  return configuredPin() !== null;
}

export function attachSessionCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set(SETTINGS_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return res;
}

export function clearSessionCookie(res: NextResponse): NextResponse {
  res.cookies.set(SETTINGS_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}

// ─── Route wrapper ────────────────────────────────────────────────────────────

type SettingsHandler = (
  req: NextRequest,
  db: SupabaseClient,
) => Promise<NextResponse>;

/**
 * withSettingsGuard — the /api/settings/* equivalent of withApiGuard.
 * Order matters: auth is checked BEFORE the DB, so an unauthenticated caller
 * cannot probe whether the service role key is configured.
 */
export function withSettingsGuard(handler: SettingsHandler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    if (!hasSettingsSession(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const db = supabaseAdmin;
    if (!db) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY is not configured" },
        { status: 503 },
      );
    }
    try {
      return await handler(req, db);
    } catch (err) {
      console.error("[settingsGuard] Unhandled error:", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

/** JSON response that must never be cached (mirrors noStoreJson). */
export function settingsJson(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
