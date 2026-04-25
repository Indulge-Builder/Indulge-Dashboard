/**
 * lib/webhookAuth.ts
 *
 * Shared webhook authentication helper.
 *
 * Usage (at the top of each POST handler, before reading the body):
 *
 *   const unauthorized = assertWebhookSecret(req);
 *   if (unauthorized) return unauthorized;
 *
 * Secret configuration:
 *   - Set WEBHOOK_SECRET env var to a random, unguessable string (32+ chars).
 *   - Configure Freshdesk / Zoho automations to send:
 *       Header: x-webhook-secret: <your secret>
 *     OR
 *       Header: Authorization: Bearer <your secret>
 *
 * Fail-open during rollout:
 *   - If WEBHOOK_SECRET is unset, the check is SKIPPED and a warning is logged once
 *     per process start. Flip to hard-require once all callers send the header.
 */

import { NextRequest, NextResponse } from "next/server";

let _missingSecretWarned = false;

export function assertWebhookSecret(req: NextRequest): NextResponse | null {
  const secret = process.env.WEBHOOK_SECRET;

  if (!secret) {
    if (!_missingSecretWarned) {
      console.warn(
        "[webhookAuth] WEBHOOK_SECRET env var is not set — webhook authentication is DISABLED. " +
          "Set WEBHOOK_SECRET and configure callers to send it as the x-webhook-secret header.",
      );
      _missingSecretWarned = true;
    }
    return null; // fail-open until secret is deployed
  }

  const token =
    req.headers.get("x-webhook-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!token || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
