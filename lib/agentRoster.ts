import type { AgentStats } from "./types";
import type { QueendomId } from "@/types";
import { QUEENDOM_IDS, queendomRecord } from "./queendom";

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

// Sanika's Queendom (added 2026-09-04; full roster from the user 2026-09-07).
// Spellings follow Freshdesk's agent names ("Kshathriya C C A", not "C A") —
// ticket attribution is a name match. The live list is the `agents` table,
// edited from /settings; this is the fallback only.
export const ROSTER_SANIKA: string[] = [
  "Kshathriya C C A",
  "Shanaya Javeri",
  "Depender Kaur",
  "Nandini Darbhamulla",
  "Gunjan Sodha",
  "Shalak Katkar",
  "Hrishikesh Badgujar",
  "Mustafa Kothari",
  "Mustafa Hussain",
];

/** Joker names mapped to their Queendom. Used for specialized Joker metrics. */
export const JOKER_ROSTER: Record<string, QueendomId> = {
  "Lilian Albrecht": "ananyshree",
  "Shruti Sharma": "anishqa",
};

export function getJokerNameForQueendom(queendom: QueendomId): string | null {
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
  /** Leaderboard seats per queendom, in display order. */
  agents: Record<QueendomId, string[]>;
  jokers: { name: string; queendom: QueendomId }[];
}

const FALLBACK_AGENTS: Record<QueendomId, string[]> = {
  ananyshree: ROSTER_ANANYSHREE,
  anishqa: ROSTER_ANISHQA,
  sanika: ROSTER_SANIKA,
};

/** The hardcoded roster expressed as a snapshot — used when the table is unusable. */
export const FALLBACK_ROSTER: RosterSnapshot = {
  agents: FALLBACK_AGENTS,
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
 * any queendom) so callers can fall back rather than blank the TV — an
 * accidental "delete all" in Settings must not empty the leaderboard.
 *
 * Per-queendom safety (2026-09-04): a queendom the table has NEVER heard of
 * (zero rows of any role/state — e.g. Sanika before migration
 * 20260904000000 is applied) gets its hardcoded `ROSTER_*` fallback, so a
 * new column is never blank on the TV. A queendom whose rows all sit
 * `is_active = false` is a deliberate Settings choice and stays empty.
 */
export function rosterFromAgentRows(
  rows: AgentRecord[] | null | undefined,
): RosterSnapshot | null {
  if (!rows?.length) return null;

  const active = rows.filter((r) => r.is_active && r.name?.trim());
  const ordered = (list: AgentRecord[]) =>
    [...list].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  const agents = queendomRecord((id) => {
    if (!rows.some((r) => r.queendom === id)) return FALLBACK_AGENTS[id];
    return ordered(active.filter((r) => r.queendom === id && r.role === "agent")).map((r) =>
      r.name.trim(),
    );
  });
  if (QUEENDOM_IDS.every((id) => agents[id].length === 0)) return null;

  const jokers = ordered(active.filter((r) => r.role === "joker")).map((r) => ({
    name: r.name.trim(),
    queendom: r.queendom,
  }));

  return { agents, jokers };
}

// ─── Builder ─────────────────────────────────────────────────────────────────
// Creates an AgentStats array with all stats at 0 — the live fetch fills them in.
export function buildRoster(names: string[], queendom: QueendomId): AgentStats[] {
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
