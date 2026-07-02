/**
 * GET /api/clients/expiring
 *
 * Clients whose `latest_subscription_end` (DATE column) falls inside the
 * current IST calendar month — the renewals each Queendom is supposed to land
 * this month, ranked soonest-first. Powers the UpcomingRenewals card in the
 * Queendom panel's rotating bottom band.
 *
 * No status filter on purpose: a client who renews early gets a new
 * `latest_subscription_end` outside the month and drops off; one who already
 * lapsed mid-month stays visible (they need the special care most).
 */

import { NextResponse } from "next/server";
import { withApiGuard, noStoreJson } from "@/lib/apiGuard";
import { getCurrentIstMonthDateBounds } from "@/lib/istDate";
import { normalizeQueendom } from "@/lib/queendom";
import type { RenewalDueClient, RenewalsDueResponse } from "@/types";

interface ExpiringClientRow {
  name: string | null;
  group: string | null;
  latest_subscription_end: string | null;
  latest_subscription_membership_type: string | null;
}

const ROW_CAP = 500;

export const GET = withApiGuard(async (_req, db) => {
  const { startDate, endExclusiveDate } = getCurrentIstMonthDateBounds();

  const { data, error } = await db
    .from("clients")
    .select("name, group, latest_subscription_end, latest_subscription_membership_type")
    .gte("latest_subscription_end", startDate)
    .lt("latest_subscription_end", endExclusiveDate)
    .order("latest_subscription_end", { ascending: true })
    .limit(ROW_CAP);

  if (error) {
    console.error("[/api/clients/expiring] Supabase error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result: RenewalsDueResponse = { ananyshree: [], anishqa: [] };
  for (const row of (data ?? []) as ExpiringClientRow[]) {
    const queendom = normalizeQueendom(row.group);
    if (!queendom || !row.name || !row.latest_subscription_end) continue;
    const item: RenewalDueClient = {
      name: row.name,
      endDate: row.latest_subscription_end,
      membershipType: row.latest_subscription_membership_type,
    };
    result[queendom].push(item);
  }

  return noStoreJson(result);
});
