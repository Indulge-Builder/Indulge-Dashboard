import { NextResponse } from "next/server";
import { requireSupabaseAdminOr503 } from "@/lib/supabaseAdmin";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ClientRow {
  group: string | null;
  latest_subscription_status: "Active" | "Expired" | null;
  latest_subscription_membership_type: string | null;
}

interface QueenBucket {
  total: number;
  celebrityActive: number;
}

interface AggregatedStats {
  ananyshree: QueenBucket;
  anishqa: QueenBucket;
}

/**
 * Paid roster — Supabase `latest_subscription_membership_type` values (trimmed,
 * case-insensitive; internal spaces normalized).
 */
const PAID_MEMBERSHIP_TYPES = new Set([
  "premium",
  "genie",
  "monthly trial",
  "standard",
]);

function normMembership(type: string | null | undefined): string {
  return (type ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function isCelebrityMembership(type: string | null | undefined): boolean {
  return normMembership(type) === "celebrity";
}

function isPaidMembership(type: string | null | undefined): boolean {
  return PAID_MEMBERSHIP_TYPES.has(normMembership(type));
}

// ─── Aggregation ──────────────────────────────────────────────────────────────
// All rows are pre-filtered to latest_subscription_status = Active.
// total: paid — membership is Premium, Genie, Monthly Trial, or Standard.
// celebrityActive: membership = Celebrity (unpaid / complimentary pill).
function aggregate(rows: ClientRow[]): AggregatedStats {
  const result: AggregatedStats = {
    ananyshree: { total: 0, celebrityActive: 0 },
    anishqa: { total: 0, celebrityActive: 0 },
  };

  for (const row of rows) {
    const grp = (row.group ?? "").toLowerCase().trim();

    let bucket: QueenBucket | null = null;
    if (grp.includes("ananyshree")) bucket = result.ananyshree;
    else if (grp.includes("anishqa")) bucket = result.anishqa;

    if (!bucket) continue;

    const tier = row.latest_subscription_membership_type;
    if (isCelebrityMembership(tier)) {
      bucket.celebrityActive++;
    } else if (isPaidMembership(tier)) {
      bucket.total++;
    }
  }

  return result;
}

// ─── GET /api/clients ─────────────────────────────────────────────────────────
// Uses the service role key — runs on the server only, bypasses RLS entirely.
// The key is never sent to the browser.
export async function GET() {
  const { db, response } = requireSupabaseAdminOr503();
  if (!db) {
    return (
      response ??
      NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY is not configured" },
        { status: 503 },
      )
    );
  }

  const { data, error } = await db
    .from("clients")
    .select("group, latest_subscription_status, latest_subscription_membership_type")
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
