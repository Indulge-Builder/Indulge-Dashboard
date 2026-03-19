/**
 * GET /api/renewals-panel?queendom=ananyshree|anishqa
 *
 * Fetches renewal and assignment data for the RenewalsPanel.
 *
 * Expected Supabase schema:
 * - renewals: { client_name, group (or queendom), created_at }
 * - members: { client_name, group (or queendom), created_at } — for new assignments
 *
 * Run: ALTER PUBLICATION supabase_realtime ADD TABLE public.renewals;
 *      ALTER PUBLICATION supabase_realtime ADD TABLE public.members;
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

type QueendomId = "ananyshree" | "anishqa";

function normalizeQueendom(q: string | null): QueendomId | null {
  const s = (q ?? "").toLowerCase().trim();
  if (s.includes("ananyshree")) return "ananyshree";
  if (s.includes("anishqa")) return "anishqa";
  return null;
}

function getThisMonthFilter() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function GET(req: NextRequest) {
  const queendom = req.nextUrl.searchParams.get("queendom") as QueendomId | null;
  if (!queendom || !["ananyshree", "anishqa"].includes(queendom)) {
    return NextResponse.json(
      { error: "Missing or invalid queendom param" },
      { status: 400 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!url || !serviceKey || serviceKey === "paste_your_service_role_key_here") {
    return NextResponse.json(
      {
        totalRenewalsThisMonth: 0,
        renewals: [],
        assignments: [],
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const monthPrefix = getThisMonthFilter();

  try {
    // ── Renewals: only columns needed for count + latest names ─────────────────
    const { data: renewalsRows, error: renewalsErr } = await db
      .from("renewals")
      .select("group, client_name, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    let totalRenewalsThisMonth = 0;
    let latestRenewals: string[] = [];

    if (!renewalsErr && renewalsRows?.length) {
      const rows = renewalsRows as Array<Record<string, unknown>>;
      const filtered = rows.filter((r) => {
        const grp = (r.group ?? r.queendom ?? "") as string;
        return normalizeQueendom(grp) === queendom;
      });
      totalRenewalsThisMonth = filtered.filter((r) => {
        const created = String(r.created_at ?? "");
        return created.startsWith(monthPrefix);
      }).length;
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
      .order("created_at", { ascending: false })
      .limit(100);

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
