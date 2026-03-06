/**
 * GET /api/agents
 *
 * Fetches every row from the `tickets` table, then for each row checks whether
 * `agent_name` belongs to one of the known roster members. Only matching rows
 * are counted. The queendom assignment comes from the roster (single source of
 * truth), not from the `queendom_name` column, so inconsistent DB values can
 * never mis-bucket an agent.
 *
 * Per-agent metrics (IST, same logic as /api/tickets):
 *
 *   tasksAssignedToday      – created_at  date  = today
 *   tasksCompletedToday     – resolved_at date  = today   AND status ∈ COMPLETED
 *   tasksCompletedThisMonth – resolved_at month = this month AND status ∈ COMPLETED
 *
 * Response:
 *   {
 *     ananyshree: Record<agentName, { tasksAssignedToday, tasksCompletedToday, tasksCompletedThisMonth }>,
 *     anishqa:    Record<agentName, { ... }>
 *   }
 */

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { ROSTER_ANANYSHREE, ROSTER_ANISHQA } from "@/lib/agentRoster";

// ─── Types ────────────────────────────────────────────────────────────────────
interface TicketRow {
  agent_name: string | null;
  status: string | null;
  created_at: string | null;
  resolved_at: string | null;
}

interface AgentBucket {
  tasksAssignedToday: number;
  tasksCompletedToday: number;
  tasksCompletedThisMonth: number;
}

// ─── Build roster lookup once at module load ──────────────────────────────────
// Maps every known agent name → their queendom so we can look up any ticket row
// in O(1) without touching queendom_name from the DB.
const AGENT_QUEENDOM = new Map<string, "ananyshree" | "anishqa">();
for (const name of ROSTER_ANANYSHREE) AGENT_QUEENDOM.set(name, "ananyshree");
for (const name of ROSTER_ANISHQA) AGENT_QUEENDOM.set(name, "anishqa");

// ─── Constants ────────────────────────────────────────────────────────────────
const COMPLETED = new Set(["resolved", "closed"]);
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

// ─── IST helpers (identical to /api/tickets) ─────────────────────────────────
function istToday(): { day: string; month: string } {
  const now = new Date(Date.now() + IST_OFFSET_MS);
  const y = now.getUTCFullYear();
  const mo = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return { day: `${y}-${mo}-${d}`, month: `${y}-${mo}` };
}

function dateParts(s: string): { day: string; month: string } {
  return { day: s.slice(0, 10), month: s.slice(0, 7) };
}

// ─── Aggregation ─────────────────────────────────────────────────────────────
function aggregate(rows: TicketRow[]): {
  ananyshree: Record<string, AgentBucket>;
  anishqa: Record<string, AgentBucket>;
} {
  const { day: todayIST, month: thisMonthIST } = istToday();

  const buckets: Record<string, AgentBucket> = {};

  // Pre-populate every roster member with zeros so agents with no tickets
  // today still appear in the response.
  for (const name of Array.from(AGENT_QUEENDOM.keys())) {
    buckets[name] = {
      tasksAssignedToday: 0,
      tasksCompletedToday: 0,
      tasksCompletedThisMonth: 0,
    };
  }

  for (const row of rows) {
    const agentName = (row.agent_name ?? "").trim();
    if (!agentName) continue;

    // Only process tickets whose agent is in our roster
    if (!AGENT_QUEENDOM.has(agentName)) continue;

    const status = (row.status ?? "").toLowerCase().trim();
    const bucket = buckets[agentName];

    // ── Assigned today: ticket was created today ──────────────────────────────
    if (row.created_at && dateParts(row.created_at).day === todayIST) {
      bucket.tasksAssignedToday++;
    }

    // ── Completed today / this month ──────────────────────────────────────────
    if (COMPLETED.has(status) && row.resolved_at) {
      const { day, month } = dateParts(row.resolved_at);
      if (day === todayIST) bucket.tasksCompletedToday++;
      if (month === thisMonthIST) bucket.tasksCompletedThisMonth++;
    }
  }

  // ── Split into queendom buckets ───────────────────────────────────────────
  const ananyshree: Record<string, AgentBucket> = {};
  const anishqa: Record<string, AgentBucket> = {};

  for (const [name, stats] of Object.entries(buckets)) {
    if (AGENT_QUEENDOM.get(name) === "ananyshree") ananyshree[name] = stats;
    else anishqa[name] = stats;
  }

  return { ananyshree, anishqa };
}

// ─── GET /api/agents ──────────────────────────────────────────────────────────
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

  // Fetch entire tickets table — only the columns we need
  const { data, error } = await db
    .from("tickets")
    .select("agent_name, status, created_at, resolved_at");

  if (error) {
    console.error("[/api/agents] Supabase error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { day: todayIST, month: thisMonthIST } = istToday();
  console.info(
    `[/api/agents] IST today: ${todayIST} | month: ${thisMonthIST} |`,
    `${data.length} total rows fetched`,
  );

  const stats = aggregate(data as TicketRow[]);

  const aAgents = Object.keys(stats.ananyshree).length;
  const iAgents = Object.keys(stats.anishqa).length;
  console.info(
    `[/api/agents] processed → ${aAgents} Ananyshree, ${iAgents} Anishqa agents`,
  );

  return NextResponse.json(stats, {
    headers: { "Cache-Control": "no-store" },
  });
}
