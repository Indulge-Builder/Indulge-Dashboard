/**
 * GET /api/tickets/rows
 *
 * Returns minimal ticket rows for client-side aggregation and Realtime patching.
 * Only columns needed for stats: id, status, queendom_name, agent_name,
 * created_at, resolved_at, is_escalated, tags. No heavy text columns.
 *
 * Scope: current IST calendar month only. ALL dashboard metrics (including
 * Pending) are month-gated — the client prune
 * (pruneTicketRowsForDashboardState) discards out-of-month rows anyway, so
 * fetching older open tickets would be wasted DB reads and payload.
 */

import { NextResponse } from "next/server";
import type { TicketRowMinimal } from "@/lib/ticketAggregation";
import { withApiGuard, noStoreJson } from "@/lib/apiGuard";
import { paginateAll } from "@/lib/db";
import { getCurrentIstMonthUtcBounds } from "@/lib/istDate";

const SELECT_COLS =
  "id:ticket_id, status, queendom_name, agent_name, created_at, is_escalated, is_incomplete, tags";

export const GET = withApiGuard(async (_req, db) => {
  const { startUtcIso: startOfMonthISTUtcIso } = getCurrentIstMonthUtcBounds();

  const { rows, error } = await paginateAll<TicketRowMinimal>((from, to) =>
    db
      .from("tickets")
      .select(SELECT_COLS)
      .gte("created_at", startOfMonthISTUtcIso)
      .range(from, to),
  );

  if (error) {
    console.error("[/api/tickets/rows] Supabase error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return noStoreJson(rows);
});
