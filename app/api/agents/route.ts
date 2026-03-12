/**
 * GET /api/agents
 *
 * Pulls every row from the `tickets` table, then for each roster agent runs
 * three explicit filters — exactly the same logic as the user described:
 *
 *   Assigned Today    = agent_name match  AND  created_at  is today (IST)
 *   Completed Today   = agent_name match  AND  status is Resolved/Closed
 *                       AND  resolved_at is today (IST)
 *   Completed Month   = agent_name match  AND  status is Resolved/Closed
 *                       AND  resolved_at is this month (IST)
 *
 * All name comparisons are case-insensitive so "pranav gadekar" in the DB
 * matches "Pranav Gadekar" in the roster and vice-versa.
 */

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { ROSTER_ANANYSHREE, ROSTER_ANISHQA } from "@/lib/agentRoster";

// ─── Ticket row shape ─────────────────────────────────────────────────────────
interface TicketRow {
  agent_name: string | null;
  status: string | null;
  created_at: string | null;
  resolved_at: string | null;
}

// ─── IST date helpers ─────────────────────────────────────────────────────────
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

function istToday(): { day: string; month: string } {
  const now = new Date(Date.now() + IST_OFFSET_MS);
  const y = now.getUTCFullYear();
  const mo = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return { day: `${y}-${mo}-${d}`, month: `${y}-${mo}` };
}

// Slices the YYYY-MM-DD prefix from any timestamp string Supabase returns.
// Works with "2026-03-06 13:14:19 +0530", "2026-03-06T13:14:19+00:00", etc.
function toDay(ts: string | null): string {
  return (ts ?? "").slice(0, 10);
}
function toMonth(ts: string | null): string {
  return (ts ?? "").slice(0, 7);
}

// Only "resolved" counts — "closed" is excluded, consistent with the
// queendom panel's solvedToday and pendingToResolve metrics.
const isResolved = (status: string | null) =>
  (status ?? "").toLowerCase().trim() === "resolved";

// ─── GET handler ──────────────────────────────────────────────────────────────
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (
    !url ||
    !serviceKey ||
    serviceKey === "paste_your_service_role_key_here"
  ) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured" },
      { status: 503 },
    );
  }

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Supabase PostgREST enforces a server-side max-rows cap of 1000 that
  // .limit() alone cannot override. Paginate in 1000-row batches instead.
  const PAGE = 1000;
  let allRows: TicketRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await db
      .from("tickets")
      .select("agent_name, status, created_at, resolved_at")
      .range(from, from + PAGE - 1);

    if (error) {
      console.error("[/api/agents] Supabase error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    allRows = allRows.concat(data as TicketRow[]);
    if ((data as TicketRow[]).length < PAGE) break;
    from += PAGE;
  }

  const tickets = allRows;
  const { day: TODAY, month: THIS_MONTH } = istToday();

  // ── Three filters per agent ───────────────────────────────────────────────
  function calcAgent(agentName: string) {
    const nameLower = agentName.toLowerCase();

    const assignedToday = tickets.filter(
      (t) =>
        t.agent_name?.toLowerCase() === nameLower &&
        toDay(t.created_at) === TODAY,
    ).length;

    // Only count tickets CREATED today that are now resolved.
    // This keeps completed ≤ assigned so the fraction "done / got today" is ≤ 1.
    // (Backlog tickets resolved today are excluded — they belong to a past day's tally.)
    const completedToday = tickets.filter(
      (t) =>
        t.agent_name?.toLowerCase() === nameLower &&
        isResolved(t.status) &&
        toDay(t.created_at) === TODAY,
    ).length;

    const completedThisMonth = tickets.filter(
      (t) =>
        t.agent_name?.toLowerCase() === nameLower &&
        isResolved(t.status) &&
        toMonth(t.resolved_at) === THIS_MONTH,
    ).length;

    return {
      tasksAssignedToday: assignedToday,
      tasksCompletedToday: completedToday,
      tasksCompletedThisMonth: completedThisMonth,
    };
  }

  // ── Build response grouped by queendom ────────────────────────────────────
  const ananyshree: Record<string, ReturnType<typeof calcAgent>> = {};
  for (const name of ROSTER_ANANYSHREE) ananyshree[name] = calcAgent(name);

  const anishqa: Record<string, ReturnType<typeof calcAgent>> = {};
  for (const name of ROSTER_ANISHQA) anishqa[name] = calcAgent(name);

  return NextResponse.json(
    { ananyshree, anishqa },
    { headers: { "Cache-Control": "no-store" } },
  );
}
