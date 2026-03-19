/**
 * GET /api/tickets
 *
 * Aggregates three metrics per queendom from the `tickets` table:
 *
 *   resolvedThisMonth – tickets whose resolved_at falls within this calendar
 *                       month AND status is "resolved" or "closed"
 *
 *   solvedToday       – tickets resolved today
 *                       (status = "resolved" only; "closed" is excluded)
 *
 *   pendingToResolve  – tickets created this month whose status is neither
 *                       "resolved" nor "closed" (every other status counts)
 *
 * ── TIMEZONE NOTE ────────────────────────────────────────────────────────────
 * All timestamps in this pipeline are IST (Freshdesk → Supabase → dashboard).
 * The IST offset (UTC+5:30) is hardcoded so "today" and "this month" boundaries
 * are always IST midnight — identical behaviour on a local IST machine, Vercel
 * (UTC), and Render (UTC). Never rely on the server's local clock for this.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Returns: { ananyshree: TicketStats, anishqa: TicketStats }
 */

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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

// ─── IST date helpers ────────────────────────────────────────────────────────
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

/**
 * Returns today's IST date as "YYYY-MM-DD" and this month as "YYYY-MM".
 * Hardcoded offset so it works on any server timezone (Vercel/Render = UTC).
 */
function istToday(): { day: string; month: string } {
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  const y = nowIST.getUTCFullYear();
  const mo = String(nowIST.getUTCMonth() + 1).padStart(2, "0");
  const d = String(nowIST.getUTCDate()).padStart(2, "0");
  return { day: `${y}-${mo}-${d}`, month: `${y}-${mo}` };
}

/**
 * Extracts the date (YYYY-MM-DD) and month (YYYY-MM) in IST from a timestamp.
 *
 * Supabase stores TIMESTAMPTZ in UTC. The raw string prefix (s.slice(0,10))
 * is the UTC date, not IST — so a ticket resolved at 2 AM IST March 19 would
 * be stored as 8:30 PM UTC March 18 and incorrectly excluded. We parse the
 * timestamp and shift to IST before extracting the date.
 */
function datePartsInIST(s: string | null): { day: string; month: string } | null {
  if (!s || s.trim().length < 10) return null;
  const ms = Date.parse(s);
  if (isNaN(ms)) return null;
  const istMs = ms + IST_OFFSET_MS;
  const istDate = new Date(istMs);
  const y = istDate.getUTCFullYear();
  const mo = String(istDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(istDate.getUTCDate()).padStart(2, "0");
  return { day: `${y}-${mo}-${d}`, month: `${y}-${mo}` };
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

    const resolvedParts = datePartsInIST(row.resolved_at);
    const createdParts = datePartsInIST(row.created_at);

    // ── 1. Resolved This Month ────────────────────────────────────────────────
    if (
      TERMINAL.has(status) &&
      resolvedParts &&
      resolvedParts.month === thisMonthIST
    ) {
      bucket.resolvedThisMonth++;
    }

    // ── 2. Solved Today ───────────────────────────────────────────────────────
    // Tickets created today AND resolved today. Status must be "resolved";
    // "closed" tickets are not counted here.
    if (
      status === RESOLVED_STATUS &&
      createdParts &&
      resolvedParts &&
      createdParts.day === todayIST &&
      resolvedParts.day === todayIST
    ) {
      bucket.solvedToday++;
    }

    // ── 3. Pending to Resolve (this month only) ───────────────────────────────
    // Any ticket this month that is neither "resolved" nor "closed".
    // Using exclusion (not a fixed allowlist) so new Freshdesk statuses
    // are automatically counted without any code change.
    if (
      !TERMINAL.has(status) &&
      createdParts &&
      createdParts.month === thisMonthIST
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (
    !url ||
    !serviceKey ||
    serviceKey === "paste_your_service_role_key_here"
  ) {
    return NextResponse.json(
      {
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
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

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
