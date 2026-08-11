/**
 * lib/apiGuard.ts
 *
 * Standard wrapper for all GET API route handlers.
 * Provides: 503 guard, catch-all error response, and the no-store JSON helper.
 *
 * Usage:
 *   export const GET = withApiGuard(async (_req, db) => {
 *     const { data } = await db.from("tickets").select("id, status");
 *     return noStoreJson(data);
 *   });
 *
 * Routes that must degrade to an empty 200 payload instead of a 503 when the
 * DB is unconfigured (TV-resilience routes) pass `noDbResponse`:
 *   export const GET = withApiGuard(handler, { noDbResponse: () => noStoreJson(EMPTY) });
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "./supabaseAdmin";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * True when a Supabase error means "that table doesn't exist" — i.e. a
 * migration hasn't been applied yet, not a real fault.
 *
 * Two codes, because the error can come from either layer: PostgREST answers
 * from its schema cache (`PGRST205`) and only Postgres itself raises
 * `42P01`. Checking just one silently misses the common case.
 */
export function isMissingTableError(
  error: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /could not find the table/i.test(error.message ?? "");
}

/** JSON response with the live-dashboard cache policy — never cache. */
export function noStoreJson(data: unknown, init?: { status?: number }): NextResponse {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: { "Cache-Control": "no-store" },
  });
}

type ApiHandler = (req: NextRequest, db: SupabaseClient) => Promise<NextResponse>;

interface ApiGuardOptions {
  /** Response when SUPABASE_SERVICE_ROLE_KEY is missing (default: 503). */
  noDbResponse?: () => NextResponse;
}

export function withApiGuard(handler: ApiHandler, opts?: ApiGuardOptions) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const db = supabaseAdmin;
    if (!db) {
      return (
        opts?.noDbResponse?.() ??
        NextResponse.json(
          { error: "SUPABASE_SERVICE_ROLE_KEY is not configured" },
          { status: 503 },
        )
      );
    }
    try {
      return await handler(req, db);
    } catch (err) {
      console.error("[apiGuard] Unhandled error:", err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  };
}
