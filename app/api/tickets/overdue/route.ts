/**
 * GET /api/tickets/overdue
 *
 * Feeds the Overdue Ticker (TV) and the mobile "Needs attention" card. Returns
 * tickets that are OPEN and escalated — the same definition as the
 * leaderboard's Overdue count (lib/ticketAggregation calcAgent: not terminal
 * AND is_escalated) so the two surfaces always agree. Terminal (resolved /
 * closed) and void (spam / deleted) rows are excluded even if their
 * `is_escalated` flag was never cleared (2026-09-05: 19 spam rows were
 * leaking into the marquee). Scoped to the live Queendoms via
 * normalizeQueendom() — Freshdesk's dead / non-concierge groups (Retail,
 * Indulge Shop, Jokers, Finance…) carried 27 stale escalations nobody on the
 * concierge screen can act on. Not month-gated — overdue carries forward.
 *
 * Columns: ticket_id (→ id), subject, agent_name, created_at, due_by.
 * `overdueSince` = due_by (the SLA breach instant) ?? created_at — the age
 * badge counts from it, not from creation. Ordered by created_at DESC so the
 * freshest escalations lead the marquee.
 *
 * Ticker resilience: every failure path degrades to an empty list (200) so a
 * transient DB error never blanks the ticker region on the TV.
 */

import { withApiGuard, noStoreJson } from "@/lib/apiGuard";
import { normalizeQueendom } from "@/lib/queendom";
import { TERMINAL_STATUSES, VOID_STATUSES } from "@/lib/ticketStatus";
import type { OverdueTicketItem } from "@/types";

/** Open escalated tickets are a small live queue; this is a safety cap, not a page. */
const ROW_CAP = 60;

/** Status names to exclude, matched case-insensitively (the webhook stores raw Freshdesk casing). */
const CLOSED_OR_VOID = [...TERMINAL_STATUSES, ...VOID_STATUSES];

export type { OverdueTicketItem };

interface OverdueTicketRow {
  id: string | number | null;
  subject: string | null;
  agent_name: string | null;
  queendom_name: string | null;
  created_at: string | null;
  due_by: string | null;
}

export const GET = withApiGuard(async (_req, db) => {
  try {
    let q = db
      .from("tickets")
      .select("id:ticket_id, subject, agent_name, queendom_name, created_at, due_by")
      .eq("is_escalated", true);
    for (const status of CLOSED_OR_VOID) {
      q = q.not("status", "ilike", status);
    }
    const { data: rows, error } = await q
      .order("created_at", { ascending: false })
      .limit(ROW_CAP);

    if (error) {
      console.error("[/api/tickets/overdue] Supabase error:", error.message);
      return noStoreJson([] as OverdueTicketItem[]);
    }

    const items: OverdueTicketItem[] = ((rows ?? []) as OverdueTicketRow[])
      .filter((r) => normalizeQueendom(r.queendom_name) !== null)
      .map((r) => {
        const id = String(r.id ?? "").trim();
        return {
          id: id || crypto.randomUUID(),
          // Fallback to the ticket id for historical rows whose subject is still
          // NULL (subject only populates on the ticket's next Freshdesk update).
          subject: (r.subject ?? "").trim() || (id ? `Ticket #${id}` : "Untitled ticket"),
          agentName: (r.agent_name ?? "").trim() || "Unassigned",
          createdAt: r.created_at ?? null,
          overdueSince: r.due_by ?? r.created_at ?? null,
        };
      });

    return noStoreJson(items);
  } catch (err) {
    console.error("[/api/tickets/overdue] Unexpected error:", err);
    return noStoreJson([] as OverdueTicketItem[]);
  }
});
