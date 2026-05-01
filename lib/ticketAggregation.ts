/**
 * Client-side aggregation from minimal ticket rows.
 * Used so Realtime can patch state (INSERT/UPDATE) without refetching.
 */

import {
  istToday,
  toISTDay,
  toISTMonth,
  utcMillisFromDbTimestamp,
} from "./istDate";
import type { TicketStats, AgentStats } from "./types";
import { ROSTER_ANANYSHREE, ROSTER_ANISHQA } from "./agentRoster";
import { buildRoster } from "./agentRoster";

/**
 * Void statuses: spam / deleted tickets stay in Supabase for audit but are
 * completely invisible to the TV dashboard — filtered out before any math.
 */
export const VOID_STATUSES = new Set(["spam", "deleted"]);
const isVoid = (s: string | null): boolean =>
  VOID_STATUSES.has((s ?? "").toLowerCase().trim());

/** Statuses that mean a ticket is legitimately done (actual successes only). */
const TERMINAL_STATUSES = new Set(["resolved", "closed"]);
const isTerminal = (s: string | null): boolean =>
  TERMINAL_STATUSES.has((s ?? "").toLowerCase().trim());

export interface TicketRowMinimal {
  id: string;
  status: string | null;
  queendom_name: string | null;
  agent_name: string | null;
  created_at: string | null;
  is_escalated: boolean | null;
  is_incomplete?: boolean | null;
  tags?: Record<string, unknown> | null;
}

interface TicketBucket {
  totalReceived: number;
  resolvedThisMonth: number;
  solvedToday: number;
  pendingToResolve: number;
  jokerSuggestion: number;
}

export function aggregateTicketStats(rows: TicketRowMinimal[]): {
  ananyshree: TicketStats;
  anishqa: TicketStats;
} {
  const { day: todayIST, month: thisMonthIST } = istToday();
  const result: {
    ananyshree: TicketBucket;
    anishqa: TicketBucket;
  } = {
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

  // Deduplicate by ticket id, then strip void (spam / deleted) rows entirely.
  const seen = new Set<string>();
  const uniqueRows: TicketRowMinimal[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    if (!isVoid(row.status)) uniqueRows.push(row);
  }

  for (const row of uniqueRows) {
    const queendom = (row.queendom_name ?? "").toLowerCase().trim();
    let bucket: TicketBucket | null = null;
    if (queendom.includes("ananyshree")) bucket = result.ananyshree;
    else if (queendom.includes("anishqa")) bucket = result.anishqa;
    if (!bucket) continue;

    const createdDay = toISTDay(row.created_at);
    const createdMonth = toISTMonth(row.created_at);
    const terminal = isTerminal(row.status);

    // Received (This Month) — created_at in current IST calendar month
    if (createdMonth === thisMonthIST) {
      bucket.totalReceived++;
    }

    // Resolved (This Month) — cohort math: created this month AND status is terminal
    if (createdMonth === thisMonthIST && terminal) {
      bucket.resolvedThisMonth++;
    }

    // Solved Today — created today AND status is terminal
    if (createdDay === todayIST && terminal) {
      bucket.solvedToday++;
    }

    // Pending — status is NOT terminal (no date gate: includes old open tickets)
    if (!terminal) {
      bucket.pendingToResolve++;
    }

    const jokerVal =
      row.tags && typeof row.tags === "object" && "joker_suggestion" in row.tags
        ? (row.tags as { joker_suggestion?: unknown }).joker_suggestion
        : undefined;
    if (jokerVal != null && jokerVal !== "") {
      bucket.jokerSuggestion++;
    }
  }

  return {
    ananyshree: result.ananyshree,
    anishqa: result.anishqa,
  };
}

interface AgentLiveStats {
  tasksAssignedToday: number;
  tasksCompletedToday: number;
  tasksCompletedThisMonth: number;
  tasksAssignedThisMonth: number;
  pendingScore: number;
  overdueCount: number;
  incomplete: number;
}

function calcAgent(
  rows: TicketRowMinimal[],
  agentName: string,
  istRef: { day: string; month: string },
): AgentLiveStats {
  const nameLower = agentName.toLowerCase();
  const TODAY = istRef.day;
  const THIS_MONTH = istRef.month;

  const assignedToday = rows.filter(
    (t) =>
      t.agent_name?.toLowerCase() === nameLower &&
      toISTDay(t.created_at) === TODAY,
  ).length;
  // Cohort math: completed today = created today AND terminal status
  const completedToday = rows.filter(
    (t) =>
      t.agent_name?.toLowerCase() === nameLower &&
      isTerminal(t.status) &&
      toISTDay(t.created_at) === TODAY,
  ).length;
  // Cohort math: completed this month = created this month AND terminal status
  const completedThisMonth = rows.filter(
    (t) =>
      t.agent_name?.toLowerCase() === nameLower &&
      isTerminal(t.status) &&
      toISTMonth(t.created_at) === THIS_MONTH,
  ).length;
  const assignedThisMonth = rows.filter(
    (t) =>
      t.agent_name?.toLowerCase() === nameLower &&
      toISTMonth(t.created_at) === THIS_MONTH,
  ).length;
  // Pending = assigned to this agent AND status NOT terminal (no date gate)
  const pendingTickets = rows.filter(
    (t) =>
      t.agent_name?.toLowerCase() === nameLower &&
      !isTerminal(t.status),
  );
  const overdueCount = pendingTickets.filter(
    (t) => t.is_escalated === true,
  ).length;
  const incomplete = rows.filter(
    (t) =>
      t.agent_name?.toLowerCase() === nameLower && t.is_incomplete === true,
  ).length;

  return {
    tasksAssignedToday: assignedToday,
    tasksCompletedToday: completedToday,
    tasksCompletedThisMonth: completedThisMonth,
    tasksAssignedThisMonth: assignedThisMonth,
    pendingScore: pendingTickets.length,
    overdueCount,
    incomplete,
  };
}

export function aggregateAgentStats(rows: TicketRowMinimal[]): {
  ananyshree: Record<string, AgentLiveStats>;
  anishqa: Record<string, AgentLiveStats>;
} {
  const istRef = istToday();

  // Strip void (spam / deleted) tickets before any per-agent math.
  const seen = new Set<string>();
  const visibleRows: TicketRowMinimal[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    if (!isVoid(row.status)) visibleRows.push(row);
  }

  const ananyshree: Record<string, AgentLiveStats> = {};
  const anishqa: Record<string, AgentLiveStats> = {};
  for (const name of ROSTER_ANANYSHREE) {
    ananyshree[name] = calcAgent(visibleRows, name, istRef);
  }
  for (const name of ROSTER_ANISHQA) {
    anishqa[name] = calcAgent(visibleRows, name, istRef);
  }
  return { ananyshree, anishqa };
}

/** Merge live stats into roster and rank by monthly volume (today as tie-breaker). */
export function mergeAndRankAgents(rows: TicketRowMinimal[]): {
  ananyshree: AgentStats[];
  anishqa: AgentStats[];
} {
  const live = aggregateAgentStats(rows);
  const rosterA = buildRoster(ROSTER_ANANYSHREE, "ananyshree");
  const rosterB = buildRoster(ROSTER_ANISHQA, "anishqa");
  const liveCI = (rec: Record<string, AgentLiveStats>) => {
    const out: Record<string, AgentLiveStats> = {};
    for (const [k, v] of Object.entries(rec)) {
      out[k.toLowerCase()] = v;
    }
    return out;
  };
  const merge = (
    roster: AgentStats[],
    rec: Record<string, AgentLiveStats>,
  ): AgentStats[] => {
    const r = liveCI(rec);
    const merged = roster.map((agent) => {
      const stats = r[agent.name.toLowerCase()];
      return stats ? { ...agent, ...stats } : agent;
    });
    return merged.sort(
      (a, b) =>
        b.tasksCompletedThisMonth - a.tasksCompletedThisMonth ||
        b.tasksCompletedToday - a.tasksCompletedToday,
    );
  };
  return {
    ananyshree: merge(rosterA, live.ananyshree),
    anishqa: merge(rosterB, live.anishqa),
  };
}

/** Max rows in Dashboard client state so Realtime + long uptimes cannot grow unbounded. */
export const MAX_TICKET_ROWS_IN_DASHBOARD_STATE = 5000;

/**
 * Keep only tickets whose created_at falls in the current IST calendar month
 * (matches aggregateTicketStats / mergeAndRankAgents gates), then cap count
 * (newest first) if the month is extremely large.
 */
export function pruneTicketRowsForDashboardState(
  rows: TicketRowMinimal[],
): TicketRowMinimal[] {
  const thisMonth = istToday().month;
  const inMonth = rows.filter((r) => toISTMonth(r.created_at) === thisMonth);
  if (inMonth.length <= MAX_TICKET_ROWS_IN_DASHBOARD_STATE) return inMonth;
  return [...inMonth]
    .sort((a, b) => {
      const ta = utcMillisFromDbTimestamp(a.created_at) ?? 0;
      const tb = utcMillisFromDbTimestamp(b.created_at) ?? 0;
      return tb - ta;
    })
    .slice(0, MAX_TICKET_ROWS_IN_DASHBOARD_STATE);
}
