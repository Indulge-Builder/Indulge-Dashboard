/**
 * lib/apiGuard.ts
 *
 * Standard wrapper for all GET API route handlers.
 * Provides: 503 guard, structured error responses.
 *
 * Usage:
 *   export const GET = withApiGuard(async (_req, db) => {
 *     const { data } = await db.from("tickets").select("id, status");
 *     return NextResponse.json(data);
 *   });
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "./supabaseAdmin";
import type { SupabaseClient } from "@supabase/supabase-js";

type ApiHandler = (req: Request, db: SupabaseClient) => Promise<NextResponse>;

export function withApiGuard(handler: ApiHandler) {
  return async (req: Request): Promise<NextResponse> => {
    const db = supabaseAdmin;
    if (!db) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 },
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
