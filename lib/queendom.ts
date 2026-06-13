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
