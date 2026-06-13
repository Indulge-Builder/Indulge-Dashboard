/**
 * GET /api/renewals-panel?queendom=ananyshree|anishqa
 *
 * Fetches renewal and assignment data for the RenewalsPanel.
 * Count + “latest” lists use the **current IST calendar month** on `created_at`
 * (same timezone rule as tickets / jokers).
 *
 * Expected Supabase schema:
 * - renewals: { client_name, group (or queendom), created_at }
 * - members: { client_name, group (or queendom), created_at } — for new assignments
 *
 * Run: ALTER PUBLICATION supabase_realtime ADD TABLE public.renewals;
 *      ALTER PUBLICATION supabase_realtime ADD TABLE public.members;
 */

import { NextResponse } from "next/server";
import { withApiGuard, noStoreJson } from "@/lib/apiGuard";
import { getCurrentIstMonthUtcBounds } from "@/lib/istDate";
import { normalizeQueendom } from "@/lib/queendom";
import type { QueendomId } from "@/types";

const MONTH_ROW_CAP = 2000;

export const GET = withApiGuard(async (req, db) => {
  const queendom = req.nextUrl.searchParams.get("queendom") as QueendomId | null;
  if (!queendom || !["ananyshree", "anishqa"].includes(queendom)) {
    return NextResponse.json(
      { error: "Missing or invalid queendom param" },
      { status: 400 }
    );
  }

  try {
    const { startUtcIso, endExclusiveUtcIso } = getCurrentIstMonthUtcBounds();

    // ── Renewals: only columns needed for count + latest names ─────────────────
    const { data: renewalsRows, error: renewalsErr } = await db
      .from("renewals")
      .select("group, client_name, created_at")
      .gte("created_at", startUtcIso)
      .lt("created_at", endExclusiveUtcIso)
      .order("created_at", { ascending: false })
      .limit(MONTH_ROW_CAP);

    let totalRenewalsThisMonth = 0;
    let latestRenewals: string[] = [];

    if (!renewalsErr && renewalsRows?.length) {
      const rows = renewalsRows as Array<Record<string, unknown>>;
      const filtered = rows.filter((r) => {
        const grp = (r.group ?? r.queendom ?? "") as string;
        return normalizeQueendom(grp) === queendom;
      });
      totalRenewalsThisMonth = filtered.length;
      latestRenewals = filtered
        .slice(0, 2)
        .map((r) => (r.client_name ?? r.name ?? "Unknown") as string)
        .filter(Boolean);
    } else if (renewalsErr) {
      console.error("[/api/renewals-panel] renewals error:", renewalsErr.message);
    }

    // ── Members (assignments): only columns needed for list ────────────────────
    let latestAssignments: string[] = [];
    const { data: membersRows, error: membersErr } = await db
      .from("members")
      .select("group, client_name, created_at")
      .gte("created_at", startUtcIso)
      .lt("created_at", endExclusiveUtcIso)
      .order("created_at", { ascending: false })
      .limit(MONTH_ROW_CAP);

    if (!membersErr && membersRows?.length) {
      const rows = membersRows as Array<Record<string, unknown>>;
      const filtered = rows.filter((r) => {
        const grp = (r.group ?? r.queendom ?? "") as string;
        return normalizeQueendom(grp) === queendom;
      });
      latestAssignments = filtered
        .slice(0, 2)
        .map((r) => (r.client_name ?? r.name ?? "Unknown") as string)
        .filter(Boolean);
    } else if (membersErr) {
      console.error("[/api/renewals-panel] members error:", membersErr.message);
    }

    return noStoreJson({
      totalRenewalsThisMonth,
      renewals: latestRenewals,
      assignments: latestAssignments,
    });
  } catch (err) {
    console.error("[/api/renewals-panel] error:", err);
    return noStoreJson({
      totalRenewalsThisMonth: 0,
      renewals: [],
      assignments: [],
    });
  }
});
