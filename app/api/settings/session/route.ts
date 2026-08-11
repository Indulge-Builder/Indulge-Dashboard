/**
 * /api/settings/session — the PIN gate for /settings.
 *
 *   GET    → { unlocked, pinConfigured }  (no secrets leaked either way)
 *   POST   → { pin } → sets the signed session cookie, or 401
 *   DELETE → clears the cookie (sign out)
 *
 * See lib/settingsAuth.ts for the cookie format and the
 * fail-closed-in-production rule.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  attachSessionCookie,
  clearSessionCookie,
  hasSettingsSession,
  isPinConfigured,
  mintSessionToken,
  pinMatches,
  settingsJson,
} from "@/lib/settingsAuth";

export async function GET(req: NextRequest) {
  return settingsJson({
    unlocked: hasSettingsSession(req),
    pinConfigured: isPinConfigured(),
  });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return settingsJson({ error: "Invalid JSON body" }, 400);
  }

  const pin = (body as { pin?: unknown } | null)?.pin;

  if (!isPinConfigured()) {
    // Dev: no PIN set means the page is already open — hand back a no-op OK so
    // the UI doesn't sit on a prompt it can never satisfy.
    if (process.env.NODE_ENV !== "production") {
      return settingsJson({ unlocked: true, pinConfigured: false });
    }
    console.error("[settings/session] SETTINGS_PIN is not set in production.");
    return settingsJson({ error: "Settings access is not configured" }, 503);
  }

  if (!pinMatches(pin)) {
    return settingsJson({ error: "Incorrect PIN" }, 401);
  }

  const token = mintSessionToken();
  if (!token) return settingsJson({ error: "Settings access is not configured" }, 503);

  return attachSessionCookie(
    NextResponse.json(
      { unlocked: true, pinConfigured: true },
      { headers: { "Cache-Control": "no-store" } },
    ),
    token,
  );
}

export async function DELETE() {
  return clearSessionCookie(
    NextResponse.json({ unlocked: false }, { headers: { "Cache-Control": "no-store" } }),
  );
}
