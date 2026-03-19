/**
 * Client-side aggregation from minimal ticket rows.
 * Used so Realtime can patch state (INSERT/UPDATE) without refetching.
 */

import { istToday, toISTDay, toISTMonth } from "./istDate";
import type { TicketStats, AgentStats } from "./types";
import { ROSTER_ANANYSHREE, ROSTER_ANISHQA } from "./agentRoster";
import { buildRoster } from "./agentRoster";

const RESOLVED = "resolved";
const TERMINAL = new Set(["resolved", "closed"]);

export interface TicketRowMinimal {
  id: string;
  status: string | null;
  queendom_name: string | null;
  agent_name: string | null;
  created_at: string | null;
  resolved_at: string | null;
  is_escalated: boolean | null;
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

  for (const row of rows) {
    const queendom = (row.queendom_name ?? "").toLowerCase().trim();
    const status = (row.status ?? "").toLowerCase().trim();
    let bucket: TicketBucket | null = null;
    if (queendom.includes("ananyshree")) bucket = result.ananyshree;
    else if (queendom.includes("anishqa")) bucket = result.anishqa;
    if (!bucket) continue;

    bucket.totalReceived++;
    const createdDay = toISTDay(row.created_at);
    const createdMonth = toISTMonth(row.created_at);
    const resolvedMonth = toISTMonth(row.resolved_at);

    if (
      TERMINAL.has(status) &&
      row.resolved_at &&
      resolvedMonth === thisMonthIST
    ) {
      bucket.resolvedThisMonth++;
    }
    if (status === RESOLVED && createdDay === todayIST) {
      bucket.solvedToday++;
    }
    if (!TERMINAL.has(status) && createdMonth === thisMonthIST) {
      bucket.pendingToResolve++;
    }
    const jokerVal =
      row.tags &&
      typeof row.tags === "object" &&
      "joker_suggestion" in row.tags
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
  escalatedCount: number;
}

function calcAgent(
  rows: TicketRowMinimal[],
  agentName: string
): AgentLiveStats {
  const nameLower = agentName.toLowerCase();
  const TODAY = istToday().day;
  const THIS_MONTH = istToday().month;
  const isResolved = (s: string | null) =>
    (s ?? "").toLowerCase().trim() === "resolved";
  const isClosed = (s: string | null) =>
    (s ?? "").toLowerCase().trim() === "closed";

  const assignedToday = rows.filter(
    (t) =>
      t.agent_name?.toLowerCase() === nameLower &&
      toISTDay(t.created_at) === TODAY
  ).length;
  const completedToday = rows.filter(
    (t) =>
      t.agent_name?.toLowerCase() === nameLower &&
      isResolved(t.status) &&
      toISTDay(t.created_at) === TODAY
  ).length;
  const completedThisMonth = rows.filter(
    (t) =>
      t.agent_name?.toLowerCase() === nameLower &&
      isResolved(t.status) &&
      toISTMonth(t.resolved_at) === THIS_MONTH
  ).length;
  const assignedThisMonth = rows.filter(
    (t) =>
      t.agent_name?.toLowerCase() === nameLower &&
      toISTMonth(t.created_at) === THIS_MONTH
  ).length;
  const pendingTickets = rows.filter(
    (t) =>
      t.agent_name?.toLowerCase() === nameLower &&
      !isResolved(t.status) &&
      !isClosed(t.status)
  );
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const overdueCount = pendingTickets.filter(
    (t) => (t.created_at ?? "").slice(0, 10) < sevenDaysAgo
  ).length;
  const escalatedCount = pendingTickets.filter(
    (t) => t.is_escalated === true
  ).length;

  return {
    tasksAssignedToday: assignedToday,
    tasksCompletedToday: completedToday,
    tasksCompletedThisMonth: completedThisMonth,
    tasksAssignedThisMonth: assignedThisMonth,
    pendingScore: pendingTickets.length,
    overdueCount,
    escalatedCount,
  };
}

export function aggregateAgentStats(rows: TicketRowMinimal[]): {
  ananyshree: Record<string, AgentLiveStats>;
  anishqa: Record<string, AgentLiveStats>;
} {
  const ananyshree: Record<string, AgentLiveStats> = {};
  const anishqa: Record<string, AgentLiveStats> = {};
  for (const name of ROSTER_ANANYSHREE) {
    ananyshree[name] = calcAgent(rows, name);
  }
  for (const name of ROSTER_ANISHQA) {
    anishqa[name] = calcAgent(rows, name);
  }
  return { ananyshree, anishqa };
}

/** Merge live stats into roster and rank by monthly volume (today as tie-breaker). */
export function mergeAndRankAgents(
  rows: TicketRowMinimal[]
): { ananyshree: AgentStats[]; anishqa: AgentStats[] } {
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
    rec: Record<string, AgentLiveStats>
  ): AgentStats[] => {
    const r = liveCI(rec);
    const merged = roster.map((agent) => {
      const stats = r[agent.name.toLowerCase()];
      return stats ? { ...agent, ...stats } : agent;
    });
    return merged.sort(
      (a, b) =>
        b.tasksCompletedThisMonth - a.tasksCompletedThisMonth ||
        b.tasksCompletedToday - a.tasksCompletedToday
    );
  };
  return {
    ananyshree: merge(rosterA, live.ananyshree),
    anishqa: merge(rosterB, live.anishqa),
  };
}
