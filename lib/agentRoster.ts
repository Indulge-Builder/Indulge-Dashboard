import type { AgentStats } from "./types";
import type { QueendomId } from "@/types";

// ─── Canonical rosters ───────────────────────────────────────────────────────
// Names must match exactly what is stored in the `agent_name` column in Supabase.
//
// NOTE (2026-08-11): these arrays are now the FALLBACK only. The live roster
// lives in the Supabase `agents` table and is edited from /settings; GET
// /api/roster serves it, and useDashboardData threads it into the aggregation.
// They are kept — not deleted — so the TV still renders a correct leaderboard
// if that table is empty, missing, or the fetch fails.

export const ROSTER_ANISHQA: string[] = [
  "Neha Sah",
  "Pranav Gadekar",
  "Dhanush K",
  "Charlotte Dias",
  "Ria Pujhari",
  "Rupali Chodankar",
  "Eeti Srinivsulu",
  "Ekta Nihalani",
  "Rutika Kale",
];

export const ROSTER_ANANYSHREE: string[] = [
  "Sanika Ahire",
  "Sakshi Bhutkar",
  "Poorti Gulati",
  "Marlene Fernandes",
  "Ajith Sajan",
  "Khushi Shah",
  "Palak Kataria",
  "Athul Jose",
  "Aditya Sonde",
];

/** Joker names mapped to their Queendom. Used for specialized Joker metrics. */
export const JOKER_ROSTER: Record<string, "ananyshree" | "anishqa"> = {
  "Lilian Albrecht": "ananyshree",
  "Shruti Sharma": "anishqa",
};

export function getJokerNameForQueendom(
  queendom: "ananyshree" | "anishqa",
): string | null {
  return (
    Object.entries(JOKER_ROSTER).find(([, q]) => q === queendom)?.[0] ?? null
  );
}

// ─── Live roster (Supabase `agents` table) ───────────────────────────────────

/** One row of the `agents` table. */
export interface AgentRecord {
  id: string;
  name: string;
  queendom: QueendomId;
  role: AgentRole;
  is_active: boolean;
  sort_order: number;
}

export type AgentRole = "agent" | "joker";

/**
 * The roster in the shape the aggregation and the Joker route consume.
 * Served by GET /api/roster; identical in shape to the fallback below, so
 * every consumer can treat "live" and "fallback" interchangeably.
 */
export interface RosterSnapshot {
  ananyshree: string[];
  anishqa: string[];
  jokers: { name: string; queendom: QueendomId }[];
}

/** The hardcoded roster expressed as a snapshot — used when the table is unusable. */
export const FALLBACK_ROSTER: RosterSnapshot = {
  ananyshree: ROSTER_ANANYSHREE,
  anishqa: ROSTER_ANISHQA,
  jokers: Object.entries(JOKER_ROSTER).map(([name, queendom]) => ({
    name,
    queendom,
  })),
};

/**
 * Folds `agents` rows into a RosterSnapshot: active rows only, ordered by
 * sort_order then name so the leaderboard's pre-stats ordering is stable.
 *
 * Returns null when there is nothing usable (no rows, or no agent-role rows for
 * either queendom) so callers can fall back rather than blank the TV — an
 * accidental "delete all" in Settings must not empty the leaderboard.
 */
export function rosterFromAgentRows(
  rows: AgentRecord[] | null | undefined,
): RosterSnapshot | null {
  if (!rows?.length) return null;

  const active = rows.filter((r) => r.is_active && r.name?.trim());
  const byQueendom = (queendom: QueendomId, role: AgentRole) =>
    active
      .filter((r) => r.queendom === queendom && r.role === role)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  const ananyshree = byQueendom("ananyshree", "agent").map((r) => r.name.trim());
  const anishqa = byQueendom("anishqa", "agent").map((r) => r.name.trim());
  if (!ananyshree.length && !anishqa.length) return null;

  const jokers = active
    .filter((r) => r.role === "joker")
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map((r) => ({ name: r.name.trim(), queendom: r.queendom }));

  return { ananyshree, anishqa, jokers };
}

// ─── Builder ─────────────────────────────────────────────────────────────────
// Creates an AgentStats array with all stats at 0 — the live fetch fills them in.
export function buildRoster(
  names: string[],
  queendom: "ananyshree" | "anishqa",
): AgentStats[] {
  return names.map((name, i) => ({
    id: `${queendom[0]}${i + 1}`,
    name,
    queendom,
    tasksAssignedToday: 0,
    tasksCompletedToday: 0,
    tasksCompletedThisMonth: 0,
    tasksAssignedThisMonth: 0,
    pendingScore: 0,
    overdueCount: 0,
    incomplete: 0,
  }));
}
