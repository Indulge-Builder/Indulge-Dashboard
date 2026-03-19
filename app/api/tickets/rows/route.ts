/**
 * GET /api/tickets/rows
 *
 * Returns minimal ticket rows for client-side aggregation and Realtime patching.
 * Only columns needed for stats: id, status, queendom_name, agent_name,
 * created_at, resolved_at, is_escalated, tags. No heavy text columns.
 */

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { TicketRowMinimal } from "@/lib/ticketAggregation";

const SELECT_COLS =
  "id:ticket_id, status, queendom_name, agent_name, created_at, resolved_at, is_escalated, tags";
const PAGE = 1000;

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (
    !url ||
    !serviceKey ||
    serviceKey === "paste_your_service_role_key_here"
  ) {
    return NextResponse.json([], {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let allRows: TicketRowMinimal[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await db
      .from("tickets")
      .select(SELECT_COLS)
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
