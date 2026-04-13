/**
 * GET /api/agents
 *
 * Pulls every row from the `tickets` table, then for each roster agent runs
 * three explicit filters — exactly the same logic as the user described:
 *
 *   Assigned Today    = agent_name match  AND  created_at  is today (IST)
 *   Completed Today   = agent_name match  AND  status is Resolved
 *                       AND  created_at is today (IST) — same spirit as /api/tickets solvedToday
 *   Completed Month   = agent_name match  AND  status is Resolved
 *                       AND  created_at is this IST month — matches Queendom “Resolved (This Month)”
 *
 * Pending (pendingScore) = agent match AND created this IST month AND not
 * resolved/closed — same monthly cohort as Queendom “Pending (This Month)”.
 *
 * All name comparisons are case-insensitive so "pranav gadekar" in the DB
 * matches "Pranav Gadekar" in the roster and vice-versa.
 */

import { NextResponse } from "next/server";
import { ROSTER_ANANYSHREE, ROSTER_ANISHQA } from "@/lib/agentRoster";
import { requireSupabaseAdminOr503 } from "@/lib/supabaseAdmin";
import { istToday, toISTDay, toISTMonth } from "@/lib/istDate";

// ─── Ticket row shape ─────────────────────────────────────────────────────────
interface TicketRow {
  agent_name: string | null;
  status: string | null;
  created_at: string | null;
  is_escalated: boolean | null;
}

// Void tickets (spam / deleted) are invisible to all dashboard metrics.
const VOID_STATUSES = new Set(["spam", "deleted"]);

// Terminal = legitimate resolutions only (spam / deleted excluded).
const TERMINAL_STATUSES = new Set(["resolved", "closed"]);
const isTerminal = (status: string | null): boolean =>
  TERMINAL_STATUSES.has((status ?? "").toLowerCase().trim());

// ─── GET handler ──────────────────────────────────────────────────────────────
export async function GET(): Promise<Response> {
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

  // Supabase PostgREST enforces a server-side max-rows cap of 1000 that
  // .limit() alone cannot override. Paginate in 1000-row batches instead.
  const PAGE = 1000;
  let allRows: TicketRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await db
      .from("tickets")
      .select("agent_name, status, created_at, is_escalated")
      .range(from, from + PAGE - 1);

    if (error) {
      console.error("[/api/agents] Supabase error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    allRows = allRows.concat(data as TicketRow[]);
    if ((data as TicketRow[]).length < PAGE) break;
    from += PAGE;
  }

  // Strip void (spam / deleted) tickets — they must not appear in any metric.
  const tickets = allRows.filter(
    (t) => !VOID_STATUSES.has((t.status ?? "").toLowerCase().trim()),
  );
  const { day: TODAY, month: THIS_MONTH } = istToday();

  // ── Three filters per agent ───────────────────────────────────────────────
  function calcAgent(agentName: string) {
    const nameLower = agentName.toLowerCase();

    const assignedToday = tickets.filter(
      (t) =>
        t.agent_name?.toLowerCase() === nameLower &&
        toISTDay(t.created_at) === TODAY,
    ).length;

    // Only count tickets CREATED today that are now resolved.
    // This keeps completed ≤ assigned so the fraction "done / got today" is ≤ 1.
    // (Backlog tickets resolved today are excluded — they belong to a past day's tally.)
    // Cohort math: completed today = created today AND terminal status
    const completedToday = tickets.filter(
      (t) =>
        t.agent_name?.toLowerCase() === nameLower &&
        isTerminal(t.status) &&
        toISTDay(t.created_at) === TODAY,
    ).length;

    // Cohort math: completed this month = created this month AND terminal status
    const completedThisMonth = tickets.filter(
      (t) =>
        t.agent_name?.toLowerCase() === nameLower &&
        isTerminal(t.status) &&
        toISTMonth(t.created_at) === THIS_MONTH,
    ).length;

    const assignedThisMonth = tickets.filter(
      (t) =>
        t.agent_name?.toLowerCase() === nameLower &&
        toISTMonth(t.created_at) === THIS_MONTH,
    ).length;

    // Pending = assigned to this agent AND status NOT terminal (no date gate)
    const pendingTickets = tickets.filter(
      (t) =>
        t.agent_name?.toLowerCase() === nameLower &&
        !isTerminal(t.status),
    );
    const pendingScore = pendingTickets.length;

    // Overdue = pending tickets where is_escalated is true (Freshdesk SLA / webhook).
    const overdueCount = pendingTickets.filter(
      (t) => t.is_escalated === true,
    ).length;

    return {
      tasksAssignedToday: assignedToday,
      tasksCompletedToday: completedToday,
      tasksCompletedThisMonth: completedThisMonth,
      tasksAssignedThisMonth: assignedThisMonth,
      pendingScore,
      overdueCount,
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
