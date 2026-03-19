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
 * Uses identical istToday/toDay/toMonth logic as /api/agents so queendom
 * solvedToday matches the sum of agents' tasksCompletedToday.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Returns: { ananyshree: TicketStats, anishqa: TicketStats }
 */

import { NextResponse } from "next/server";
import { requireSupabaseAdminOr503 } from "@/lib/supabaseAdmin";

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

// ─── IST date helpers (identical to /api/agents) ─────────────────────────────
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

function istToday(): { day: string; month: string } {
  const now = new Date(Date.now() + IST_OFFSET_MS);
  const y = now.getUTCFullYear();
  const mo = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return { day: `${y}-${mo}-${d}`, month: `${y}-${mo}` };
}

// Slices the YYYY-MM-DD prefix from any timestamp string Supabase returns.
// Same as agents: "2026-03-06 13:14:19 +0530", "2026-03-06T13:14:19+00:00", etc.
function toDay(ts: string | null): string {
  return (ts ?? "").slice(0, 10);
}
function toMonth(ts: string | null): string {
  return (ts ?? "").slice(0, 7);
}

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

    const createdDay = toDay(row.created_at);
    const createdMonth = toMonth(row.created_at);
    const resolvedMonth = toMonth(row.resolved_at);

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
  if (response || !db) return response;

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
