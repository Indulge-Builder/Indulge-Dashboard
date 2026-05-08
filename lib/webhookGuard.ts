/**
 * lib/webhookGuard.ts
 *
 * Standard wrapper for all POST webhook handlers.
 * Provides: fail-closed auth, body parsing, schema validation, DB guard,
 * and structured error responses.
 *
 * Usage:
 *   function validate(raw: unknown): MyBody | null { ... }
 *
 *   export const POST = withWebhookGuard(validate, async (body, db) => {
 *     await db.from("table").insert({ ... });
 *     return NextResponse.json({ ok: true });
 *   });
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "./supabaseAdmin";
import { assertWebhookSecret } from "./webhookAuth";
import type { SupabaseClient } from "@supabase/supabase-js";

type WebhookHandler<T> = (
  body: T,
  db: SupabaseClient,
  req: NextRequest,
) => Promise<NextResponse>;

export function withWebhookGuard<T>(
  validate: (raw: unknown) => T | null,
  handler: WebhookHandler<T>,
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const authError = assertWebhookSecret(req);
    if (authError) return authError;

    const db = supabaseAdmin;
    if (!db) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 },
      );
    }

    let rawBody: unknown;
    const contentType = req.headers.get("content-type") ?? "";
    try {
      if (contentType.includes("application/x-www-form-urlencoded")) {
        const text = await req.text();
        rawBody = Object.fromEntries(new URLSearchParams(text));
      } else {
        rawBody = await req.json();
      }
    } catch {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const body = validate(rawBody);
    if (!body) {
      console.warn("[webhookGuard] Rejected payload — missing required fields");
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    try {
      return await handler(body, db, req);
    } catch (err) {
      console.error("[webhookGuard] Unhandled error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  };
}
