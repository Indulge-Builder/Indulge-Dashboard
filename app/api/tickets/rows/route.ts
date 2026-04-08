/**
 * GET /api/tickets/rows
 *
 * Returns minimal ticket rows for client-side aggregation and Realtime patching.
 * Only columns needed for stats: id, status, queendom_name, agent_name,
 * created_at, resolved_at, is_escalated, tags. No heavy text columns.
 */

import { NextResponse } from "next/server";
import type { TicketRowMinimal } from "@/lib/ticketAggregation";
import { requireSupabaseAdminOr503 } from "@/lib/supabaseAdmin";
import { getCurrentIstMonthUtcBounds } from "@/lib/istDate";

const SELECT_COLS =
  "id:ticket_id, status, queendom_name, agent_name, created_at, resolved_at, is_escalated, tags";
const PAGE = 1000;

export async function GET() {
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

  const { startUtcIso: startOfMonthISTUtcIso } = getCurrentIstMonthUtcBounds();
  // Safety: always include old tickets that are still pending (status not Resolved/Closed),
  // even if they were created before the current IST month.
  //
  // Note: status in the DB may have inconsistent casing; we exclude common variants.
  const resolvedClosedVariants = [
    "resolved",
    "Resolved",
    "RESOLVED",
    "closed",
    "Closed",
    "CLOSED",
  ];
  const orFilter = [
    `created_at.gte.${startOfMonthISTUtcIso}`,
    `status.not.in.(${resolvedClosedVariants.join(",")})`,
  ].join(",");

  let allRows: TicketRowMinimal[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await db
      .from("tickets")
      .select(SELECT_COLS)
      .or(orFilter)
      .range(from, from + PAGE - 1);

    if (error) {
      const isTagsError =
        /column.*tags.*does not exist|tags.*does not exist/i.test(
          error.message,
        );
      if (from === 0 && isTagsError) {
        let fallbackRows: TicketRowMinimal[] = [];
        let fbFrom = 0;
        for (;;) {
          const { data: fbData, error: fbErr } = await db
            .from("tickets")
            .select(
              "id:ticket_id, status, queendom_name, agent_name, created_at, resolved_at, is_escalated",
            )
            .or(orFilter)
            .range(fbFrom, fbFrom + PAGE - 1);
          if (fbErr) {
            console.error("[/api/tickets/rows] Supabase error:", fbErr.message);
            return NextResponse.json({ error: fbErr.message }, { status: 500 });
          }
          const chunk = (fbData as Record<string, unknown>[]).map((r) => ({
            ...r,
            tags: null,
          })) as TicketRowMinimal[];
          fallbackRows = fallbackRows.concat(chunk);
          if (chunk.length < PAGE) break;
          fbFrom += PAGE;
        }
        return NextResponse.json(fallbackRows, {
          headers: { "Cache-Control": "no-store" },
        });
      }
      console.error("[/api/tickets/rows] Supabase error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const chunk = data as TicketRowMinimal[];
    allRows = allRows.concat(chunk);
    if (chunk.length < PAGE) break;
    from += PAGE;
  }

  return NextResponse.json(allRows, {
    headers: { "Cache-Control": "no-store" },
  });
}
