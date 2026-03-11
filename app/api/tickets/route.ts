/**
 * GET /api/tickets
 *
 * Aggregates six metrics per queendom from the `tickets` table:
 *
 *   totalThisMonth    – tickets where created_at (IST) is within this month
 *   receivedToday     – tickets where created_at (IST) is today
 *   resolvedThisMonth – resolved/closed tickets where resolved_at (IST) is this month
 *   solvedToday       – resolved/closed tickets where resolved_at (IST) is today
 *   pendingToResolve  – active-status tickets created this month (IST)
 *   overdueCount      – active-status tickets created BEFORE today (IST)
 *
 * ── TIMEZONE HANDLING ─────────────────────────────────────────────────────────
 * Supabase returns TIMESTAMPTZ values as UTC strings regardless of how they
 * were inserted (e.g. "2026-03-11T07:14:19+00:00"). dateParts() converts each
 * UTC instant to the IST equivalent (UTC+5:30) before extracting the calendar
 * date, so "today" and "this month" boundaries always match IST midnight — the
 * same reference used by istToday().
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Returns: { ananyshree: TicketStats, anishqa: TicketStats }
 */

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

interface TicketRow {
  status:        string | null;
  queendom_name: string | null;
  created_at:    string | null;
  resolved_at:   string | null;
}

interface TicketBucket {
  totalThisMonth:    number;
  receivedToday:     number;
  resolvedThisMonth: number;
  solvedToday:       number;
  pendingToResolve:  number;
  overdueCount:      number;
}

interface AggregatedStats {
  ananyshree: TicketBucket;
  anishqa:    TicketBucket;
}

// ── Status sets ───────────────────────────────────────────────────────────────
const COMPLETED = new Set(["resolved", "closed"]);

const ACTIVE = new Set([
  "open",
  "pending",
  "nudge client",
  "nudge vendor",
  "ongoing delivery",
  "invoice due",
]);

// ── IST date helpers ──────────────────────────────────────────────────────────
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

/**
 * Returns the current IST calendar date ("YYYY-MM-DD") and month ("YYYY-MM").
 * Hard-coded offset so this is always correct on UTC servers (Vercel / Render).
 */
function istToday(): { day: string; month: string } {
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  const y  = nowIST.getUTCFullYear();
  const mo = String(nowIST.getUTCMonth() + 1).padStart(2, "0");
  const d  = String(nowIST.getUTCDate()).padStart(2, "0");
  return { day: `${y}-${mo}-${d}`, month: `${y}-${mo}` };
}

/**
 * Converts a timestamp stored in Supabase (returned as UTC) to the IST
 * calendar date and month.
 *
 * WHY: PostgreSQL TIMESTAMPTZ normalises everything to UTC. Supabase returns
 * values like "2026-03-11T07:14:19+00:00". If we naively slice the first 10
 * characters we get the UTC date, which differs from the IST date for any
 * timestamp between midnight IST (18:30 UTC previous day) and 05:30 IST
 * (00:00 UTC). Applying the IST offset before slicing gives the correct IST
 * calendar date in all cases.
 *
 * FALLBACK: if the string cannot be parsed as a Date (e.g. a bare "YYYY-MM-DD"
 * with no time component), we fall back to prefix slicing — this preserves
 * backward compatibility with any pre-existing rows that may already hold the
 * IST date stored as a plain text-like value.
 */
function dateParts(s: string): { day: string; month: string } {
  const utc = new Date(s);
  if (isNaN(utc.getTime())) {
    // Non-parseable string → treat as already an IST-formatted prefix
    return { day: s.slice(0, 10), month: s.slice(0, 7) };
  }
  // Shift UTC instant to IST wall-clock time, then read UTC fields (which now
  // reflect IST calendar values because we added the offset).
  const ist = new Date(utc.getTime() + IST_OFFSET_MS);
  const day = [
    ist.getUTCFullYear(),
    String(ist.getUTCMonth() + 1).padStart(2, "0"),
    String(ist.getUTCDate()).padStart(2, "0"),
  ].join("-");
  return { day, month: day.slice(0, 7) };
}

// ── Aggregation ───────────────────────────────────────────────────────────────
function aggregate(rows: TicketRow[]): AggregatedStats {
  const { day: todayIST, month: thisMonthIST } = istToday();

  const empty = (): TicketBucket => ({
    totalThisMonth:    0,
    receivedToday:     0,
    resolvedThisMonth: 0,
    solvedToday:       0,
    pendingToResolve:  0,
    overdueCount:      0,
  });

  const result: AggregatedStats = {
    ananyshree: empty(),
    anishqa:    empty(),
  };

  for (const row of rows) {
    const queendom = (row.queendom_name ?? "").toLowerCase().trim();
    const status   = (row.status        ?? "").toLowerCase().trim();

    let bucket: TicketBucket | null = null;
    if (queendom.includes("ananyshree"))      bucket = result.ananyshree;
    else if (queendom.includes("anishqa"))    bucket = result.anishqa;
    if (!bucket) continue;

    // Derive IST calendar dates from the stored UTC timestamps
    const { day: createdDay, month: createdMonth } =
      row.created_at ? dateParts(row.created_at) : { day: "", month: "" };

    // ── 1. Total This Month ─────────────────────────────────────────────────
    if (createdMonth === thisMonthIST) bucket.totalThisMonth++;

    // ── 2. Received Today ───────────────────────────────────────────────────
    if (createdDay === todayIST) bucket.receivedToday++;

    // ── 3. Resolved This Month ──────────────────────────────────────────────
    if (COMPLETED.has(status) && row.resolved_at) {
      if (dateParts(row.resolved_at).month === thisMonthIST) bucket.resolvedThisMonth++;
    }

    // ── 4. Solved Today ─────────────────────────────────────────────────────
    if (COMPLETED.has(status) && row.resolved_at) {
      if (dateParts(row.resolved_at).day === todayIST) bucket.solvedToday++;
    }

    // ── 5. Pending to Resolve (active, created this month) ──────────────────
    if (ACTIVE.has(status) && createdMonth === thisMonthIST) {
      bucket.pendingToResolve++;
    }

    // ── 6. Overdue (active, created BEFORE today) ───────────────────────────
    if (ACTIVE.has(status) && createdDay !== "" && createdDay < todayIST) {
      bucket.overdueCount++;
    }
  }

  return result;
}

// ── GET handler ───────────────────────────────────────────────────────────────
export async function GET() {
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL        ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY       ?? "";

  if (!url || !serviceKey || serviceKey === "paste_your_service_role_key_here") {
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
