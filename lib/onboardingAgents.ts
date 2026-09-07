/**
 * lib/onboardingAgents.ts
 *
 * The Onboarding roster (Zoho CRM lead owners shown on the Revenue TV screen)
 * and the name-normalisation helpers that match Zoho owner names to cards.
 *
 * ── Roster as of 2026-09-07 (read from Zoho users API) ───────────────────────
 *   Active "Onboarding Manager" / "Onboarding Agents" roles:
 *     Samson Fernandes · Kaniisha Chamarria · Nandini Pandey · Kabeer Dhawan ·
 *     Surbhi Dewan   (the last three joined 2026-08-17)
 *   Gone: Amit Agarwal, Meghana Singh (disabled 2026-08-17);
 *         Vikram, Katya, Harsh Gupta — the Shop / Retail team (deleted 2026-06-16).
 *   Not on the TV: "Admin @ Indulge" (automation owner of every WhatsApp /
 *   web-form lead until reassignment) and the founders.
 *
 * The screen keeps its two agent columns; `column` says which one a seat
 * renders in. Both columns are Onboarding — there is no department any more.
 * Shop will get its own screen when that team is rebuilt.
 *
 * UPDATE THIS FILE when agents join / leave; portraits live in
 * `onboarding-agents-images/<id>.webp` (see components/onboarding/utils.ts).
 */

export type AgentColumn = "left" | "right";

export const AGENT_COLUMNS: readonly AgentColumn[] = ["left", "right"] as const;

/** Heading shown above each column. */
export const AGENT_COLUMN_LABEL: Readonly<Record<AgentColumn, string>> = {
  left: "Onboarding",
  right: "Onboarding",
};

export interface OnboardingAgentCard {
  /** Stable id — also the portrait preset key. */
  id: string;
  /** Card label (first name). */
  name: string;
  /** Full owner name as Zoho sends it in `agent_name`. */
  zohoName: string;
  column: AgentColumn;
}

/** Fixed display order (top → bottom within each column). */
export const ONBOARDING_AGENT_CARDS: readonly OnboardingAgentCard[] = [
  { id: "samson",   name: "Samson",   zohoName: "Samson Fernandes",   column: "left"  },
  { id: "kaniisha", name: "Kaniisha", zohoName: "Kaniisha Chamarria", column: "left"  },
  { id: "nandini",  name: "Nandini",  zohoName: "Nandini Pandey",     column: "right" },
  { id: "kabeer",   name: "Kabeer",   zohoName: "Kabeer Dhawan",      column: "right" },
  { id: "surbhi",   name: "Surbhi",   zohoName: "Surbhi Dewan",       column: "right" },
] as const;

export const ALL_AGENT_DISPLAY_NAMES: readonly string[] = ONBOARDING_AGENT_CARDS.map(
  (c) => c.name,
);

export function cardsForColumn(column: AgentColumn): readonly OnboardingAgentCard[] {
  return ONBOARDING_AGENT_CARDS.filter((c) => c.column === column);
}

// ── Display-name mapping and Zoho storage normalisation ───────────────────────

/**
 * UI-facing compact label used on cards/chips.
 * Converts full Zoho owner names to the card's first-name display style.
 *
 * @example
 *   getDisplayAgentName("Samson Fernandes")  // "Samson"
 *   getDisplayAgentName("Admin @ Indulge")   // "Admin"
 */
export function getDisplayAgentName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";

  const firstToken = trimmed.split(/[\s/,]/)[0] ?? trimmed;
  if (!firstToken) return trimmed;

  const lower = firstToken.toLowerCase();
  const canonical = ALL_AGENT_DISPLAY_NAMES.find((n) => n.toLowerCase() === lower);
  if (canonical) return canonical;

  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Normalizes Zoho `agent_name` for storage in Supabase.
 * We intentionally store the full owner name as received (trimmed/collapsed),
 * and only map to short display labels in the UI.
 *
 * @example
 *   normalizeZohoAgentName("  Samson   Fernandes ") // "Samson Fernandes"
 */
export function normalizeZohoAgentName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

// ── Name matching ─────────────────────────────────────────────────────────────

/**
 * Match a card's display name to a stored `agent_name` value (exact,
 * case-insensitive, or compound e.g. "Samson/Neha" → Samson).
 *
 * Used by /api/onboarding to aggregate lead and deal counts per agent.
 */
export function onboardingAgentNameMatches(
  cardDisplayName: string,
  storedAgentName: string,
): boolean {
  const stored = storedAgentName.trim().toLowerCase();
  if (!stored) return false;
  const card      = cardDisplayName.trim().toLowerCase();
  const cardFirst = card.split(/\s+/)[0] ?? "";

  if (stored === card)      return true;
  if (stored === cardFirst) return true;

  const storedFirst     = stored.split(/[/,]/)[0]?.trim() ?? stored;
  if (storedFirst === card)      return true;
  if (storedFirst === cardFirst) return true;

  const storedFirstWord = storedFirst.split(/\s+/)[0] ?? "";
  if (storedFirstWord === card)      return true;
  if (storedFirstWord === cardFirst) return true;

  if (stored.startsWith(`${card}/`)      || stored.startsWith(`${card} `))      return true;
  if (stored.startsWith(`${cardFirst}/`) || stored.startsWith(`${cardFirst} `)) return true;

  return false;
}

// ── Fallback agent cards ──────────────────────────────────────────────────────

/**
 * Zeroed rows for every roster seat. Used when /api/onboarding fails so the
 * TV always shows all seats.
 */
export const ONBOARDING_FALLBACK_AGENTS = ONBOARDING_AGENT_CARDS.map((c) => ({
  id: c.id,
  name: c.name,
  leadsCreatedThisMonth: 0,
  totalConverted:        0,
  leadsCreatedTodayIst:  0,
  leadsThisMonth:        0,
}));
