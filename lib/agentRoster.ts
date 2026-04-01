import type { AgentStats } from "./types";

// ─── Canonical rosters ───────────────────────────────────────────────────────
// Names must match exactly what is stored in the `agent_name` column in Supabase.

export const ROSTER_ANISHQA: string[] = [
  "Sagar Ali",
  "Savio Francis Fernandes",
  "Pranav Gadekar",
  "Dhanush K",
  "Charlotte Dias",
  "Aniruddha Morajkar",
  "Laxmi Khaire",
  "Eeti Srinivsulu",
];

export const ROSTER_ANANYSHREE: string[] = [
  "Sanika Ahire",
  "Ragadh Shahul",
  "Aditya Sonde",
  "Shaurya Verma",
  "Poorti Gulati",
  "Anshika Eark",
  "Ajith Sajan",
  "Khushi Shah",
];

/** Joker names mapped to their Queendom. Used for specialized Joker metrics. */
export const JOKER_ROSTER: Record<string, "ananyshree" | "anishqa"> = {
  "Lilian Albrecht": "ananyshree",
  "Anil Talluri": "anishqa",
};

export function getJokerNameForQueendom(
  queendom: "ananyshree" | "anishqa",
): string | null {
  return (
    Object.entries(JOKER_ROSTER).find(([, q]) => q === queendom)?.[0] ?? null
  );
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
  }));
}
