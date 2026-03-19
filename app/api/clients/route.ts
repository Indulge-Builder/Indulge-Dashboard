import { NextResponse } from "next/server";
import { requireSupabaseAdminOr503 } from "@/lib/supabaseAdmin";

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
  const { db, response } = requireSupabaseAdminOr503();
  if (response || !db) return response;

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
