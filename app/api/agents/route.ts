/**
 * GET /api/agents
 *
 * Pulls every row from the `tickets` table and computes four stats per agent:
 *
 *   tasksAssignedToday    = agent_name match  AND  created_at  (IST) is today
 *   tasksCompletedToday   = agent_name match  AND  status is Resolved/Closed
 *                           AND  resolved_at (IST) is today
 *                           (includes backlog tickets resolved today)
 *   tasksCompletedMonth   = agent_name match  AND  status is Resolved/Closed
 *                           AND  resolved_at (IST) is this month
 *   overdueCount          = agent_name match  AND  status is Active
 *                           AND  created_at (IST) is BEFORE today
 *
 * ── TIMEZONE HANDLING ─────────────────────────────────────────────────────────
 * Supabase returns TIMESTAMPTZ values as UTC (e.g. "2026-03-11T07:14:19+00:00").
 * toDay() / toMonth() convert each UTC instant to IST (UTC+5:30) before
 * extracting the calendar date, so boundaries always align with IST midnight.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { ROSTER_ANANYSHREE, ROSTER_ANISHQA } from "@/lib/agentRoster";

// ── Ticket row shape ──────────────────────────────────────────────────────────
interface TicketRow {
  agent_name:  string | null;
  status:      string | null;
  created_at:  string | null;
  resolved_at: string | null;
}

// ── IST date helpers ──────────────────────────────────────────────────────────
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

function istToday(): { day: string; month: string } {
  const now = new Date(Date.now() + IST_OFFSET_MS);
  const y   = now.getUTCFullYear();
  const mo  = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d   = String(now.getUTCDate()).padStart(2, "0");
  return { day: `${y}-${mo}-${d}`, month: `${y}-${mo}` };
}

/**
 * Converts a Supabase UTC timestamp to the IST calendar date "YYYY-MM-DD".
 *
 * Supabase returns TIMESTAMPTZ as UTC strings. Slicing the first 10 chars
 * gives the UTC date, which is wrong for the early IST morning hours
 * (between midnight IST and 05:30 IST = the previous UTC calendar day).
 * We add the IST offset before reading the date fields to always get the
 * correct IST calendar date.
 *
 * Falls back to prefix slicing for non-parseable values (e.g. NULL → "").
 */
function toDay(ts: string | null): string {
  if (!ts) return "";
  const utc = new Date(ts);
  if (isNaN(utc.getTime())) return ts.slice(0, 10); // fallback
  const ist = new Date(utc.getTime() + IST_OFFSET_MS);
  return [
    ist.getUTCFullYear(),
    String(ist.getUTCMonth() + 1).padStart(2, "0"),
    String(ist.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function toMonth(ts: string | null): string {
  if (!ts) return "";
  const utc = new Date(ts);
  if (isNaN(utc.getTime())) return ts.slice(0, 7); // fallback
  const ist = new Date(utc.getTime() + IST_OFFSET_MS);
  return [
    ist.getUTCFullYear(),
    String(ist.getUTCMonth() + 1).padStart(2, "0"),
  ].join("-");
}

// ── Status helpers ────────────────────────────────────────────────────────────
const RESOLVED = new Set(["resolved", "closed"]);
const isResolved = (status: string | null) =>
  RESOLVED.has((status ?? "").toLowerCase().trim());

// Mirrors the ACTIVE set in /api/tickets
const ACTIVE = new Set([
  "open",
  "pending",
  "nudge client",
  "nudge vendor",
  "ongoing delivery",
  "invoice due",
]);

// ── GET handler ───────────────────────────────────────────────────────────────
export async function GET() {
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

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
    .select("agent_name, status, created_at, resolved_at");

  if (error) {
    console.error("[/api/agents] Supabase error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tickets = data as TicketRow[];
  const { day: TODAY, month: THIS_MONTH } = istToday();

  function calcAgent(agentName: string) {
    const nameLower = agentName.toLowerCase();

    // Tickets assigned to this agent today (created today, any status).
    const tasksAssignedToday = tickets.filter(
      (t) =>
        t.agent_name?.toLowerCase() === nameLower &&
        toDay(t.created_at) === TODAY,
    ).length;

    // Tickets RESOLVED today by this agent.
    // Uses resolved_at (not created_at) so backlog tickets from previous days
    // that an agent closes today are correctly counted in their daily runrate.
    const tasksCompletedToday = tickets.filter(
      (t) =>
        t.agent_name?.toLowerCase() === nameLower &&
        isResolved(t.status)                      &&
        toDay(t.resolved_at) === TODAY,
    ).length;

    // Tickets resolved by this agent this calendar month.
    const tasksCompletedThisMonth = tickets.filter(
      (t) =>
        t.agent_name?.toLowerCase() === nameLower &&
        isResolved(t.status)                      &&
        toMonth(t.resolved_at) === THIS_MONTH,
    ).length;

    // Backlog: active tickets assigned to this agent created BEFORE today.
    const overdueCount = tickets.filter(
      (t) =>
        t.agent_name?.toLowerCase() === nameLower &&
        ACTIVE.has((t.status ?? "").toLowerCase().trim()) &&
        toDay(t.created_at) < TODAY                       &&
        toDay(t.created_at) !== "",
    ).length;

    return {
      tasksAssignedToday,
      tasksCompletedToday,
      tasksCompletedThisMonth,
      overdueCount,
    };
  }

  // ── Build response grouped by queendom ─────────────────────────────────────
  const ananyshree: Record<string, ReturnType<typeof calcAgent>> = {};
  for (const name of ROSTER_ANANYSHREE) ananyshree[name] = calcAgent(name);

  const anishqa: Record<string, ReturnType<typeof calcAgent>> = {};
  for (const name of ROSTER_ANISHQA) anishqa[name] = calcAgent(name);

  return NextResponse.json(
    { ananyshree, anishqa },
    { headers: { "Cache-Control": "no-store" } },
  );
}
