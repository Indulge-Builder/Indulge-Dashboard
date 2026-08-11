import type { QueendomId } from "@/types";

/**
 * Single source of truth for queendom/group matching (dry-audit D4).
 * Freshdesk/Zoho send decorated names (e.g. "Team Ananyshree"), so matching
 * is `.includes()` on the lowercased string, never equality (CLAUDE.md #8).
 */
export function normalizeQueendom(
  raw: string | null | undefined,
): QueendomId | null {
  const s = (raw ?? "").toLowerCase().trim();
  if (s.includes("ananyshree")) return "ananyshree";
  if (s.includes("anishqa")) return "anishqa";
  return null;
}

/** The two queendom ids, in the order the TV shows them. */
export const QUEENDOM_IDS: readonly QueendomId[] = ["ananyshree", "anishqa"];

/**
 * The canonical label written to `renewals.group` / `members.group` (and
 * already used by `clients.group`) — 2026-08-11 normalisation.
 *
 * Before it, the same two teams were stored three different ways:
 *   renewals "ananyshree" · members "Ananyshree's Queendom" · clients "Ananyshree Queendom"
 *
 * Anything this app WRITES must use this. Reads still go through
 * normalizeQueendom(), because externally-fed tables (tickets, jokers, clients)
 * were deliberately left on their own spellings.
 */
export const QUEENDOM_LABEL: Record<QueendomId, string> = {
  ananyshree: "Ananyshree Queendom",
  anishqa: "Anishqa Queendom",
};

/** Short human name for UI chips and headings. */
export const QUEENDOM_DISPLAY_NAME: Record<QueendomId, string> = {
  ananyshree: "Ananyshree",
  anishqa: "Anishqa",
};
