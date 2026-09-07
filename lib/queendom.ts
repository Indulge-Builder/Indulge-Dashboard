import type { QueendomId } from "@/types";

/**
 * Single source of truth for queendom/group matching (dry-audit D4).
 * Freshdesk/Zoho send decorated names (e.g. "Team Ananyshree",
 * "Sanika's Queendom"), so matching is `.includes()` on the lowercased
 * string, never equality (CLAUDE.md #8).
 *
 * Adding a queendom (2026-09-04, Sanika): extend `QueendomId` in types/index.ts,
 * add the id here (TV column order), its two labels below, a `ROSTER_*`
 * fallback in lib/agentRoster.ts, a Special Dates section, and a migration
 * that widens the `agents` CHECK, the renewals/members label trigger, and
 * `live_queendom_id()` in Postgres. Everything else iterates QUEENDOM_IDS.
 */
export function normalizeQueendom(
  raw: string | null | undefined,
): QueendomId | null {
  const s = (raw ?? "").toLowerCase().trim();
  if (s.includes("ananyshree")) return "ananyshree";
  if (s.includes("anishqa")) return "anishqa";
  if (s.includes("sanika")) return "sanika";
  return null;
}

/** The queendom ids, in the order the TV shows them (left → right). */
export const QUEENDOM_IDS: readonly QueendomId[] = ["anishqa", "sanika", "ananyshree"];

/** Type guard for untrusted input (query params, request bodies). */
export function isQueendomId(raw: unknown): raw is QueendomId {
  return typeof raw === "string" && (QUEENDOM_IDS as readonly string[]).includes(raw);
}

/**
 * Builds a complete per-queendom record from a factory — the one way to
 * create `{ anishqa, sanika, ananyshree }` shapes so no call site can forget a
 * queendom when the list grows.
 */
export function queendomRecord<T>(make: (id: QueendomId) => T): Record<QueendomId, T> {
  const out = {} as Record<QueendomId, T>;
  for (const id of QUEENDOM_IDS) out[id] = make(id);
  return out;
}

/**
 * The canonical label written to `renewals.group` / `members.group` (and
 * already used by `clients.group`) — 2026-08-11 normalisation.
 *
 * Anything this app WRITES must use this. Reads still go through
 * normalizeQueendom(), because externally-fed tables (tickets, jokers, clients)
 * were deliberately left on their own spellings.
 */
export const QUEENDOM_LABEL: Record<QueendomId, string> = {
  ananyshree: "Ananyshree Queendom",
  anishqa: "Anishqa Queendom",
  sanika: "Sanika Queendom",
};

/** Short human name for UI chips and headings. */
export const QUEENDOM_DISPLAY_NAME: Record<QueendomId, string> = {
  ananyshree: "Ananyshree",
  anishqa: "Anishqa",
  sanika: "Sanika",
};
