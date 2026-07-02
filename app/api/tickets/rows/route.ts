/**
 * GET /api/tickets/rows
 *
 * Returns minimal ticket rows for client-side aggregation and Realtime patching.
 * Only columns needed for stats: id, status, queendom_name, agent_name,
 * created_at, resolved_at, is_escalated, tags. No heavy text columns.
 *
 * Scope (dry-audit D2, revised 2026-07-02): current IST calendar month PLUS the
 * still-open backlog from earlier months. Every metric except Overdue and
 * Incomplete (incl. Pending) stays month-gated via explicit date checks in
 * lib/ticketAggregation.ts; Overdue / Incomplete carry forward across month
 * rollover — a ticket escalated or incomplete in June must still count in
 * July until it is cleared.
 *
 * The backlog query filters status case-insensitively (chained `not.ilike`)
 * because the webhook stores the raw Freshdesk status string, not a lowercased
 * one. Terminal/void names come from lib/ticketStatus.ts — never inline them.
 */

import { NextResponse } from "next/server";
import type { TicketRowMinimal } from "@/lib/ticketAggregation";
import { withApiGuard, noStoreJson } from "@/lib/apiGuard";
import { paginateAll } from "@/lib/db";
import { getCurrentIstMonthUtcBounds } from "@/lib/istDate";
import { TERMINAL_STATUSES, VOID_STATUSES } from "@/lib/ticketStatus";

const SELECT_COLS =
  "id:ticket_id, status, queendom_name, agent_name, created_at, resolved_at, is_escalated, is_incomplete, tags";

const CLOSED_OR_VOID = [...TERMINAL_STATUSES, ...VOID_STATUSES];

export const GET = withApiGuard(async (_req, db) => {
  const { startUtcIso: startOfMonthISTUtcIso } = getCurrentIstMonthUtcBounds();

  // Current IST month — feeds every period metric.
  const monthQuery = paginateAll<TicketRowMinimal>((from, to) =>
    db
      .from("tickets")
      .select(SELECT_COLS)
      .gte("created_at", startOfMonthISTUtcIso)
      .range(from, to),
  );

  // Open backlog from earlier months — feeds Overdue / Incomplete only.
  // Naturally small: it is the live queue, not history.
  const backlogQuery = paginateAll<TicketRowMinimal>((from, to) => {
    let q = db
      .from("tickets")
      .select(SELECT_COLS)
      .lt("created_at", startOfMonthISTUtcIso);
    for (const status of CLOSED_OR_VOID) {
      q = q.not("status", "ilike", status);
    }
    return q.range(from, to);
  });

  const [monthResult, backlogResult] = await Promise.all([
    monthQuery,
    backlogQuery,
  ]);

  const error = monthResult.error ?? backlogResult.error;
  if (error) {
    console.error("[/api/tickets/rows] Supabase error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Merge with month rows winning on id collision (there should be none — the
  // two queries partition on created_at — but Realtime races make dedup cheap
  // insurance).
  const seen = new Set<string>();
  const rows: TicketRowMinimal[] = [];
  for (const row of [...monthResult.rows, ...backlogResult.rows]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    rows.push(row);
  }

  return noStoreJson(rows);
});
