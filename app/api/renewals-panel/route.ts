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

import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseAdminOr503 } from "@/lib/supabaseAdmin";
import { getCurrentIstMonthUtcBounds } from "@/lib/istMonthBounds";

type QueendomId = "ananyshree" | "anishqa";

function normalizeQueendom(q: string | null): QueendomId | null {
  const s = (q ?? "").toLowerCase().trim();
  if (s.includes("ananyshree")) return "ananyshree";
  if (s.includes("anishqa")) return "anishqa";
  return null;
}

const MONTH_ROW_CAP = 2000;

export async function GET(req: NextRequest) {
  const queendom = req.nextUrl.searchParams.get("queendom") as QueendomId | null;
  if (!queendom || !["ananyshree", "anishqa"].includes(queendom)) {
    return NextResponse.json(
      { error: "Missing or invalid queendom param" },
      { status: 400 }
    );
  }

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

    return NextResponse.json(
      {
        totalRenewalsThisMonth,
        renewals: latestRenewals,
        assignments: latestAssignments,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[/api/renewals-panel] error:", err);
    return NextResponse.json(
      {
        totalRenewalsThisMonth: 0,
        renewals: [],
        assignments: [],
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
