/**
 * GET /api/tickets
 *
 * Aggregates four metrics per queendom from the `tickets` table:
 *
 *   totalThisMonth   – tickets where created_at is within this month
 *
 *   solvedThisMonth  – Resolved | Closed  AND  resolved_at is within this month
 *
 *   solvedToday      – Resolved | Closed  AND  resolved_at is within today
 *                      (IST midnight → now)
 *
 *   pendingToResolve – any active status (Open, Pending, Nudge Client …)
 *                      AND created_at is within this month
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
}

interface TicketBucket {
  totalThisMonth: number;
  solvedThisMonth: number;
  solvedToday: number;
  pendingToResolve: number;
}

interface AggregatedStats {
  ananyshree: TicketBucket;
  anishqa: TicketBucket;
}

// ─── Status sets ─────────────────────────────────────────────────────────────
const COMPLETED = new Set(["resolved", "closed"]);

const ACTIVE = new Set([
  "open",
  "pending",
  "nudge client",
  "nudge vendor",
  "ongoing delivery",
  "invoice due",
]);

// ─── IST date helpers ────────────────────────────────────────────────────────
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000 // UTC+5:30

/**
 * Returns today's IST date as "YYYY-MM-DD" and this month as "YYYY-MM".
 * Hardcoded offset so it works on any server timezone (Vercel/Render = UTC).
 */
function istToday(): { day: string; month: string } {
  const nowIST = new Date(Date.now() + IST_OFFSET_MS)
  const y  = nowIST.getUTCFullYear()
  const mo = String(nowIST.getUTCMonth() + 1).padStart(2, "0")
  const d  = String(nowIST.getUTCDate()).padStart(2, "0")
  return { day: `${y}-${mo}-${d}`, month: `${y}-${mo}` }
}

/**
 * Extracts the date (YYYY-MM-DD) and month (YYYY-MM) prefix from a timestamp
 * string exactly as it is stored in Supabase — no timezone conversion.
 *
 * All timestamps in this system are IST values stored as-is (the date part
 * you see in the Supabase table IS the IST date). Comparing prefixes is
 * therefore both simpler and correct, regardless of what timezone suffix
 * Supabase appends when returning the data.
 *
 * Works with:  "2026-03-01 21:38:49"
 *              "2026-03-01T21:38:49+00:00"
 *              "2026-03-01T21:38:49.123456+00:00"
 */
function dateParts(s: string): { day: string; month: string } {
  return { day: s.slice(0, 10), month: s.slice(0, 7) }
}

// ─── Aggregation ─────────────────────────────────────────────────────────────
function aggregate(rows: TicketRow[]): AggregatedStats {
  const { day: todayIST, month: thisMonthIST } = istToday()

  const result: AggregatedStats = {
    ananyshree: {
      totalThisMonth: 0,
      solvedThisMonth: 0,
      solvedToday: 0,
      pendingToResolve: 0,
    },
    anishqa: {
      totalThisMonth: 0,
      solvedThisMonth: 0,
      solvedToday: 0,
      pendingToResolve: 0,
    },
  };

  for (const row of rows) {
    const queendom = (row.queendom_name ?? "").toLowerCase().trim();
    const status = (row.status ?? "").toLowerCase().trim();

    let bucket: TicketBucket | null = null;
    if (queendom.includes("ananyshree")) bucket = result.ananyshree;
    else if (queendom.includes("anishqa")) bucket = result.anishqa;
    if (!bucket) continue;

    // ── 1. Total This Month ───────────────────────────────────────────────────
    if (row.created_at && dateParts(row.created_at).month === thisMonthIST) {
      bucket.totalThisMonth++
    }

    // ── 2 & 3. Solved This Month / Solved Today ───────────────────────────────
    if (COMPLETED.has(status) && row.resolved_at) {
      const { day, month } = dateParts(row.resolved_at)
      if (month === thisMonthIST) bucket.solvedThisMonth++
      if (day   === todayIST)    bucket.solvedToday++
    }

    // ── 4. Pending to Resolve (this month only) ───────────────────────────────
    if (ACTIVE.has(status) && row.created_at && dateParts(row.created_at).month === thisMonthIST) {
      bucket.pendingToResolve++
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
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured" },
      { status: 503 },
    );
  }

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await db
    .from("tickets")
    .select("status, queendom_name, created_at, resolved_at");

  if (error) {
    console.error("[/api/tickets] Supabase error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const stats = aggregate(data as TicketRow[]);

  return NextResponse.json(stats, {
    headers: { "Cache-Control": "no-store" },
  });
}
