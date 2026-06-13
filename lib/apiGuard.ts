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
