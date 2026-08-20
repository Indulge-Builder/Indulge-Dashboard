/**
 * GET /api/tickets/overdue-list
 *
 * The full overdue drill-down for the mobile "Needs attention" sheet —
 * every open escalated ticket with the detail columns the `tickets` table
 * actually holds (subject, agent, queendom, priority, type, channel,
 * created/due/pending-since timestamps). The TV's marquee keeps using the
 * minimal /api/tickets/overdue; this one exists for tap-through detail.
 */

import { NextResponse } from "next/server";
import { withApiGuard, noStoreJson } from "@/lib/apiGuard";

const MAX_ROWS = 200;

export interface OverdueDetailRow {
  ticket_id: string;
  subject: string | null;
  status: string | null;
  agent_name: string | null;
  queendom_name: string | null;
  priority: number | null;
  ticket_type: string | null;
  source: string | null;
  created_at: string | null;
  due_by: string | null;
  pending_since: string | null;
}

export const GET = withApiGuard(async (_req, db) => {
  const { data, error } = await db
    .from("tickets")
    .select(
      "ticket_id, subject, status, agent_name, queendom_name, priority, ticket_type, source, created_at, due_by, pending_since",
    )
    .eq("is_escalated", true)
    .not("status", "in", '("Resolved","Closed","spam","deleted")')
    .order("created_at", { ascending: true }) // oldest debt first
    .limit(MAX_ROWS);

  if (error) {
    console.error("[/api/tickets/overdue-list] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return noStoreJson((data ?? []) as OverdueDetailRow[]);
});
