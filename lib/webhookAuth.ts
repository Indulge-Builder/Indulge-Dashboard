/**
 * lib/webhookAuth.ts
 *
 * Webhook authentication helper used by all three POST webhook handlers.
 *
 * Behaviour:
 *   - Production (NODE_ENV=production): WEBHOOK_SECRET must be set.
 *     Missing secret → hard rejection of ALL incoming webhook calls.
 *   - Development / test: missing secret logs a warning and passes through.
 *     Set WEBHOOK_AUTH_DISABLED=true to suppress the warning in test suites.
 *
 * Callers send the secret via either header:
 *   x-webhook-secret: <secret>
 *   Authorization: Bearer <secret>
 *
 * Comparison uses Node's crypto.timingSafeEqual to prevent timing attacks.
 */

import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

function secretsEqual(a: string, b: string): boolean {
  // timingSafeEqual requires same-length buffers — length mismatch is instant-reject.
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function assertWebhookSecret(req: NextRequest): NextResponse | null {
  const secret = process.env.WEBHOOK_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[webhookAuth] WEBHOOK_SECRET is not set in production — rejecting all webhook calls.",
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (process.env.WEBHOOK_AUTH_DISABLED !== "true") {
      console.warn(
        "[webhookAuth] WEBHOOK_SECRET not set — auth disabled (dev/test only). " +
          "Set WEBHOOK_AUTH_DISABLED=true to suppress this warning.",
      );
    }
    return null;
  }

  const token =
    req.headers.get("x-webhook-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    req.nextUrl.searchParams.get("secret");

  if (!token || !secretsEqual(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
