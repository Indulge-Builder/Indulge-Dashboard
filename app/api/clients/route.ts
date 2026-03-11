import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ClientRow {
  group: string | null;
  latest_subscription_status: "Active" | "Expired" | null;
}

interface QueenBucket {
  total: number;
}

interface AggregatedStats {
  ananyshree: QueenBucket;
  anishqa: QueenBucket;
}

// ─── Aggregation ──────────────────────────────────────────────────────────────
function aggregate(rows: ClientRow[]): AggregatedStats {
  const result: AggregatedStats = {
    ananyshree: { total: 0 },
    anishqa: { total: 0 },
  };

  for (const row of rows) {
    const grp = (row.group ?? "").toLowerCase().trim();

    let bucket: QueenBucket | null = null;
    if (grp.includes("ananyshree")) bucket = result.ananyshree;
    else if (grp.includes("anishqa")) bucket = result.anishqa;

    if (!bucket) continue;

    bucket.total++;
  }

  return result;
}

// ─── GET /api/clients ─────────────────────────────────────────────────────────
// Uses the service role key — runs on the server only, bypasses RLS entirely.
// The key is never sent to the browser.
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (
    !url ||
    !serviceKey ||
    serviceKey === "paste_your_service_role_key_here"
  ) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured in .env.local" },
      { status: 503 },
    );
  }

  // Server-side admin client — auth.persistSession must be false for API routes
  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await db
    .from("clients")
    .select("group, latest_subscription_status")
    .eq("latest_subscription_status", "Active");

  if (error) {
    console.error("[/api/clients] Supabase error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const stats = aggregate(data as ClientRow[]);

  return NextResponse.json(stats, {
    headers: {
      // Never cache — always fresh for a live dashboard
      "Cache-Control": "no-store",
    },
  });
}
