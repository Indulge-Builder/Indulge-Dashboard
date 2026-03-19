import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

declare global {
  // eslint-disable-next-line no-var
  var __supabaseAdmin__: SupabaseClient | undefined;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const supabaseAdmin: SupabaseClient | null =
  !supabaseUrl ||
  !serviceRoleKey ||
  serviceRoleKey === "paste_your_service_role_key_here"
    ? null
    : (globalThis.__supabaseAdmin__ ??= createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }));

export function requireSupabaseAdminOr503(): {
  db: SupabaseClient | null;
  response: NextResponse | null;
} {
  if (supabaseAdmin) {
    return { db: supabaseAdmin, response: null };
  }

  return {
    db: null,
    response: NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured" },
      { status: 503 },
    ),
  };
}
