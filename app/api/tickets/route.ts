/**
 * GET /api/tickets
 *
 * Aggregates metrics per queendom from the `tickets` table:
 *
 *   resolvedThisMonth – tickets whose resolved_at falls within this IST
 *                       month AND status is "resolved" or "closed"
 *
 *   solvedToday       – tickets CREATED today (IST) that are now resolved.
 *                       (status = "resolved" only; "closed" excluded)
 *                       Uses same date logic as /api/agents for consistency.
 *
 *   pendingToResolve  – tickets created this IST month whose status is neither
 *                       "resolved" nor "closed"
 *
 * ── TIMEZONE NOTE ────────────────────────────────────────────────────────────
 * Uses lib/istDate (Asia/Kolkata) — same as Dashboard client aggregation and
 * /api/agents — never slice the ISO prefix (that is the UTC calendar date).
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Returns: { ananyshree: TicketStats, anishqa: TicketStats }
 */

import { NextResponse } from "next/server";
import { requireSupabaseAdminOr503 } from "@/lib/supabaseAdmin";
import { istToday, toISTDay, toISTMonth } from "@/lib/istDate";

interface TicketRow {
  status: string | null;
  queendom_name: string | null;
  created_at: string | null;
  resolved_at: string | null;
  tags: Record<string, unknown> | null;
}

interface TicketBucket {
  totalReceived: number; // count of ALL rows where queendom_name matches
  resolvedThisMonth: number;
  solvedToday: number;
  pendingToResolve: number;
  jokerSuggestion: number; // tickets with tags.joker_suggestion set
}

interface AggregatedStats {
  ananyshree: TicketBucket;
  anishqa: TicketBucket;
}

// ─── Status sets ─────────────────────────────────────────────────────────────

// Only "resolved" counts for solvedToday.
const RESOLVED_STATUS = "resolved";

// Both "resolved" and "closed" are terminal — excluded from pendingToResolve.
const TERMINAL = new Set(["resolved", "closed"]);

// ─── Aggregation ─────────────────────────────────────────────────────────────
function aggregate(rows: TicketRow[]): AggregatedStats {
  const { day: todayIST, month: thisMonthIST } = istToday();

  const result: AggregatedStats = {
    ananyshree: {
      totalReceived: 0,
      resolvedThisMonth: 0,
      solvedToday: 0,
      pendingToResolve: 0,
      jokerSuggestion: 0,
    },
    anishqa: {
      totalReceived: 0,
      resolvedThisMonth: 0,
      solvedToday: 0,
      pendingToResolve: 0,
      jokerSuggestion: 0,
    },
  };

  for (const row of rows) {
    const queendom = (row.queendom_name ?? "").toLowerCase().trim();
    const status = (row.status ?? "").toLowerCase().trim();

    let bucket: TicketBucket | null = null;
    if (queendom.includes("ananyshree")) bucket = result.ananyshree;
    else if (queendom.includes("anishqa")) bucket = result.anishqa;
    if (!bucket) continue;

    // ── 0. Total Received (all rows for this queendom) ─────────────────────────
    bucket.totalReceived++;

    const createdDay = toISTDay(row.created_at);
    const createdMonth = toISTMonth(row.created_at);
    const resolvedMonth = toISTMonth(row.resolved_at);

    // ── 1. Resolved This Month ────────────────────────────────────────────────
    if (
      TERMINAL.has(status) &&
      row.resolved_at &&
      resolvedMonth === thisMonthIST
    ) {
      bucket.resolvedThisMonth++;
    }

    // ── 2. Solved Today ───────────────────────────────────────────────────────
    // Tickets CREATED today that are now resolved. Same logic as agents'
    // tasksCompletedToday: created_at day === TODAY, status = "resolved".
    if (
      status === RESOLVED_STATUS &&
      createdDay === todayIST
    ) {
      bucket.solvedToday++;
    }

    // ── 3. Pending to Resolve (this month only) ───────────────────────────────
    if (
      !TERMINAL.has(status) &&
      createdMonth === thisMonthIST
    ) {
      bucket.pendingToResolve++;
    }

    // ── 4. Joker Suggestion — tickets with tags.joker_suggestion set ──────────
    const jokerVal =
      row.tags && typeof row.tags === "object" && "joker_suggestion" in row.tags
        ? (row.tags as { joker_suggestion?: unknown }).joker_suggestion
        : undefined;
    if (jokerVal != null && jokerVal !== "") {
      bucket.jokerSuggestion++;
    }
  }

  return result;
}

// ─── GET handler ─────────────────────────────────────────────────────────────
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

  // Supabase PostgREST enforces a server-side max-rows cap of 1000 that
  // .limit() alone cannot override. Paginate in 1000-row batches instead.
  const PAGE = 1000;
  let allRows: TicketRow[] = [];
  let from = 0;
  const selectCols = "status, queendom_name, created_at, resolved_at, tags";

  while (true) {
    const { data, error } = await db
      .from("tickets")
      .select(selectCols)
      .range(from, from + PAGE - 1);

    if (error) {
      // If tags column doesn't exist, retry without it (jokerSuggestion will be 0)
      const isTagsColumnError =
        /column.*tags.*does not exist|tags.*does not exist|does not exist.*tags/i.test(
          error.message,
        );
      if (from === 0 && isTagsColumnError) {
        const fallbackRows: TicketRow[] = [];
        let fallbackFrom = 0;
        while (true) {
          const fb = await db
            .from("tickets")
            .select("status, queendom_name, created_at, resolved_at")
            .range(fallbackFrom, fallbackFrom + PAGE - 1);
          if (fb.error) {
            console.error("[/api/tickets] Supabase error:", fb.error.message);
            return NextResponse.json(
              { error: fb.error.message },
              { status: 500 },
            );
          }
          const rows = (fb.data as Record<string, unknown>[]).map((r) => ({
            ...r,
            tags: null as Record<string, unknown> | null,
          })) as TicketRow[];
          fallbackRows.push(...rows);
          if (rows.length < PAGE) break;
          fallbackFrom += PAGE;
        }
        const stats = aggregate(fallbackRows);
        return NextResponse.json(stats, {
          headers: { "Cache-Control": "no-store" },
        });
      }
      console.error("[/api/tickets] Supabase error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    allRows = allRows.concat(data as TicketRow[]);
    if ((data as TicketRow[]).length < PAGE) break;
    from += PAGE;
  }

  const stats = aggregate(allRows);

  return NextResponse.json(stats, {
    headers: { "Cache-Control": "no-store" },
  });
}
