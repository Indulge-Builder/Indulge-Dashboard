/**
 * GET /api/tickets
 *
 * Aggregates metrics per queendom from the `tickets` table:
 *
 *   totalReceived     – tickets whose created_at falls within this IST calendar month
 *
 *   resolvedThisMonth – tickets created this IST month AND status is
 *                       "resolved" only ("closed" is not scored as resolved)
 *
 *   solvedToday       – tickets CREATED today (IST) that are now resolved.
 *                       (status = "resolved" only; "closed" excluded)
 *                       Uses same date logic as /api/agents for consistency.
 *
 *   pendingToResolve  – tickets created this IST month whose status is neither
 *                       "resolved" nor "closed"
 *
 *   "closed" is never scored as resolved and never counted as pending; it only
 *   affects totalReceived if created this month (Received may exceed Pending+Resolved).
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
  totalReceived: number; // created this IST month (matches QueendomPanel “Received This Month”)
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

const RESOLVED_STATUS = "resolved";
const CLOSED_STATUS = "closed";

const isResolvedStatus = (s: string) => s === RESOLVED_STATUS;
/** Pending = every status except resolved and closed (closed is not scored). */
const isPendingStatus = (s: string) =>
  !isResolvedStatus(s) && s !== CLOSED_STATUS;

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

    const createdDay = toISTDay(row.created_at);
    const createdMonth = toISTMonth(row.created_at);

    // ── 0. Received (This Month) — created_at in current IST calendar month ─────
    if (createdMonth === thisMonthIST) {
      bucket.totalReceived++;
    }

    // ── 1. Resolved (This Month) — created this IST month, status resolved only
    if (createdMonth === thisMonthIST && isResolvedStatus(status)) {
      bucket.resolvedThisMonth++;
    }

    // ── 2. Solved Today ───────────────────────────────────────────────────────
    // Tickets CREATED today that are now resolved. Same logic as agents'
    // tasksCompletedToday: created_at day === TODAY, status = "resolved".
    if (status === RESOLVED_STATUS && createdDay === todayIST) {
      bucket.solvedToday++;
    }

    // ── 3. Pending to Resolve (this month only) — not resolved, not closed ───
    if (createdMonth === thisMonthIST && isPendingStatus(status)) {
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
