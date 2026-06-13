import { NextResponse } from "next/server";
import { withApiGuard, noStoreJson } from "@/lib/apiGuard";
import { normalizeQueendom } from "@/lib/queendom";

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
    const queendom = normalizeQueendom(row.group);
    if (!queendom) continue;
    const bucket: QueenBucket = result[queendom];

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
export const GET = withApiGuard(async (_req, db) => {
  const { data, error } = await db
    .from("clients")
    .select("group, latest_subscription_status, latest_subscription_membership_type")
    .eq("latest_subscription_status", "Active");

  if (error) {
    console.error("[/api/clients] Supabase error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return noStoreJson(aggregate(data as ClientRow[]));
});
