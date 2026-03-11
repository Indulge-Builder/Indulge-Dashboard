import type { AgentStats } from "./types";

// ─── Canonical rosters ───────────────────────────────────────────────────────
// Names must match exactly what is stored in the `agent_name` column in Supabase.

export const ROSTER_ANISHQA: string[] = [
  "Iqbal Ali",
  "Pawani Tiwari",
  "Sagar Ali",
  "Savio Francis Fernandes",
  "Pranav Gadekar",
  "Dhanush K",
  "Archana S",
  "Aniruddha Morajkar",
  "Laxmi Khaire",
  "Anishqa Bhagia",
];

export const ROSTER_ANANYSHREE: string[] = [
  "Bhavarth Pednekar",
  "Nabisab Banashi",
  "Sanika Ahire",
  "Ragadh Shahul",
  "Aditya Sonde",
  "Shaurya Verma",
  "Poorti Gulati",
  "Anshika Eark",
  "Ajith Sajan",
  "Khushi Shah",
  "Lilian Albrecht",
  "Ananyshree Munshi",
];

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
    overdueCount: 0,
  }));
}
