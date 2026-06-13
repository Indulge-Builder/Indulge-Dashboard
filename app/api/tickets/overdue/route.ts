/**
 * GET /api/tickets/overdue
 *
 * Feeds the Overdue Ticker. Returns escalated (is_escalated = true) tickets
 * regardless of month — overdue tickets are frequently older than the current
 * IST month, so this route intentionally does NOT month-gate (unlike
 * /api/tickets/rows, which powers month-gated dashboard math).
 *
 * Columns: ticket_id (→ id), subject, agent_name, created_at.
 * Ordered by created_at DESC so the freshest escalations lead the marquee.
 *
 * Ticker resilience: every failure path degrades to an empty list (200) so a
 * transient DB error never blanks the ticker region on the TV.
 */

import { withApiGuard, noStoreJson } from "@/lib/apiGuard";
import type { OverdueTicketItem } from "@/types";

export type { OverdueTicketItem };

interface OverdueTicketRow {
  id: string | number | null;
  subject: string | null;
  agent_name: string | null;
  created_at: string | null;
}

export const GET = withApiGuard(async (_req, db) => {
  try {
    const { data: rows, error } = await db
      .from("tickets")
      .select("id:ticket_id, subject, agent_name, created_at")
      .eq("is_escalated", true)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      console.error("[/api/tickets/overdue] Supabase error:", error.message);
      return noStoreJson([] as OverdueTicketItem[]);
    }

    const items: OverdueTicketItem[] = (rows ?? []).map(
      (r: OverdueTicketRow) => {
        const id = String(r.id ?? "").trim();
        return {
          id: id || crypto.randomUUID(),
          // Fallback to the ticket id for historical rows whose subject is still
          // NULL (subject only populates on the ticket's next Freshdesk update).
          subject: (r.subject ?? "").trim() || (id ? `Ticket #${id}` : "Untitled ticket"),
          agentName: (r.agent_name ?? "").trim() || "Unassigned",
        };
      },
    );

    return noStoreJson(items);
  } catch (err) {
    console.error("[/api/tickets/overdue] Unexpected error:", err);
    return noStoreJson([] as OverdueTicketItem[]);
  }
});
