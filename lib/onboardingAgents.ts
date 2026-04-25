/**
 * lib/onboardingAgents.ts
 *
 * Canonical agent roster, department mapping, and name-normalisation helpers
 * for the Revenue Dashboard TV screen.
 *
 * Two departments:
 *   Concierge — Amit, Samson, Meghana
 *   Shop      — Vikram, Katya, Harsh
 *
 * Department is derived entirely at runtime from the agent's display name via
 * getAgentDepartment(). No database column is required.
 *
 * Zoho CRM now stores owner names as full names in DB/webhooks.
 * UI mapping to card labels is done at read time via getDisplayAgentName().
 */

import type { Department } from "./onboardingTypes";

// ── Concierge agents ──────────────────────────────────────────────────────────

export const CONCIERGE_AGENT_DISPLAY_NAMES = [
  "Amit",
  "Samson",
  "Meghana",
  "Kaniisha",
] as const;

export type ConciergeAgentDisplayName =
  (typeof CONCIERGE_AGENT_DISPLAY_NAMES)[number];

/** Fixed display order for Concierge column (left → right). */
export const CONCIERGE_AGENT_CARDS: readonly {
  id: string;
  name: ConciergeAgentDisplayName;
}[] = [
  { id: "amit",    name: "Amit"    },
  { id: "samson",  name: "Samson"  },
  { id: "meghana", name: "Meghana" },
  { id: "kaniisha", name: "Kaniisha" },
] as const;

// ── Shop agents ───────────────────────────────────────────────────────────────

export const SHOP_AGENT_DISPLAY_NAMES = [
  "Vikram",
  "Katya",
  "Harsh",
] as const;

export type ShopAgentDisplayName =
  (typeof SHOP_AGENT_DISPLAY_NAMES)[number];

/** Fixed display order for Shop column (left → right). */
export const SHOP_AGENT_CARDS: readonly {
  id: string;
  name: ShopAgentDisplayName;
}[] = [
  { id: "vikram", name: "Vikram" },
  { id: "katya",  name: "Katya"  },
  { id: "harsh",  name: "Harsh"  },
] as const;

// ── Combined roster ───────────────────────────────────────────────────────────

export type AnyAgentDisplayName =
  | ConciergeAgentDisplayName
  | ShopAgentDisplayName;

/**
 * All known agent display names across both departments.
 * Used for IN-list queries and first-word fallback matching.
 */
export const ALL_AGENT_DISPLAY_NAMES: readonly AnyAgentDisplayName[] = [
  ...CONCIERGE_AGENT_DISPLAY_NAMES,
  ...SHOP_AGENT_DISPLAY_NAMES,
] as const;

/**
 * Legacy alias — kept so existing imports of ONBOARDING_AGENT_DISPLAY_NAMES
 * in the current /api/onboarding route continue to compile unchanged.
 * @deprecated Use ALL_AGENT_DISPLAY_NAMES going forward.
 */
export const ONBOARDING_AGENT_DISPLAY_NAMES = ALL_AGENT_DISPLAY_NAMES;

/**
 * Legacy alias — kept so existing imports of ONBOARDING_AGENT_CARDS
 * in utils.ts and route.ts compile unchanged.
 * Post-overhaul: prefer CONCIERGE_AGENT_CARDS or SHOP_AGENT_CARDS.
 * @deprecated Use CONCIERGE_AGENT_CARDS / SHOP_AGENT_CARDS.
 */
export const ONBOARDING_AGENT_CARDS = CONCIERGE_AGENT_CARDS;

// ── Department map ────────────────────────────────────────────────────────────

/**
 * Maps every canonical display name (lowercased) to its department.
 *
 * HOW IT WORKS — no DB migration needed:
 *   getAgentDepartment(agentName) normalises the stored agent_name to its
 *   first word, lowercases it, and looks it up here. Any Zoho variation such
 *   as "Amit Agarwal", "amit", or "Amit/Backup" all resolve to "concierge"
 *   because the first-word extraction always yields "amit".
 *
 * UPDATE THIS MAP when agents are added / moved between teams.
 */
export const DEPARTMENT_BY_AGENT_KEY: Readonly<Record<string, Department>> = {
  // Concierge
  amit:    "concierge",
  samson:  "concierge",
  meghana: "concierge",
  kaniisha: "concierge",
  // Shop
  vikram:  "shop",
  katya:   "shop",
  harsh:   "shop",
} as const;

/**
 * Resolves a raw agent_name string (from Supabase, Zoho webhook, or API
 * response) to its Department without a database column.
 *
 * Matching priority:
 *   1. First token (split by whitespace, "/" or ",") mapped via DEPARTMENT_BY_AGENT_KEY
 *   2. Falls back to "concierge" so unknown agents never disappear from UI
 *
 * @example
 *   getAgentDepartment("Samson Fernandes") // → "concierge"
 *   getAgentDepartment("vikram")           // → "shop"
 *   getAgentDepartment("Harsh/Backup")     // → "shop"
 *   getAgentDepartment("Unknown Agent")    // → "concierge"  (safe fallback)
 */
export function getAgentDepartment(agentName: string): Department {
  const trimmed = agentName.trim().replace(/\s+/g, " ");
  if (!trimmed) return "concierge";

  // First-token extraction handles "Amit Agarwal", "Harsh/Backup", "samson".
  const firstToken = trimmed.split(/[\s/,]/)[0]?.toLowerCase() ?? "";
  return DEPARTMENT_BY_AGENT_KEY[firstToken] ?? "concierge";
}

// ── Display-name mapping and Zoho storage normalisation ───────────────────────

/**
 * UI-facing compact label used on cards/chips.
 * Converts full Zoho owner names to the card's first-name display style.
 *
 * @example
 *   getDisplayAgentName("Amit Agarwal")   // "Amit"
 *   getDisplayAgentName("Katya")          // "Katya"
 *   getDisplayAgentName("Admin @ Indulge")// "Admin"
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
 *   normalizeZohoAgentName("  Amit   Agarwal ") // "Amit Agarwal"
 */
export function normalizeZohoAgentName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

// ── Name matching ─────────────────────────────────────────────────────────────

/**
 * Match a card's display name to a stored `agent_name` value (exact,
 * case-insensitive, or compound e.g. "Samson/Neha" → Samson).
 *
 * Used by /api/onboarding to aggregate lead-touch and ledger counts per agent.
 * Works for both Concierge and Shop agents without modification.
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
 * Returns a zeroed OnboardingAgentRow for a given card spec.
 * Used when /api/onboarding fails so the TV always shows all six seats.
 */
function zeroedAgent(
  id: string,
  name: AnyAgentDisplayName,
  department: Department,
) {
  return {
    id,
    name,
    department,
    totalAttempted:       0,
    totalConverted:       0,
    leadsAttendToday:     0,
    leadsThisMonth:       0,
    closedLakhsThisMonth: 0,
  } as const;
}

export const CONCIERGE_FALLBACK_AGENTS = CONCIERGE_AGENT_CARDS.map((c) =>
  zeroedAgent(c.id, c.name, "concierge"),
);

export const SHOP_FALLBACK_AGENTS = SHOP_AGENT_CARDS.map((c) =>
  zeroedAgent(c.id, c.name, "shop"),
);

/**
 * Legacy flat fallback array for the existing OnboardingPanel until Step 2
 * migrates it to the dual-department layout.
 * @deprecated Use CONCIERGE_FALLBACK_AGENTS / SHOP_FALLBACK_AGENTS.
 */
export const FALLBACK_AGENTS = CONCIERGE_FALLBACK_AGENTS;
