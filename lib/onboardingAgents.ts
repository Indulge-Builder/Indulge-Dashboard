/**
 * Canonical onboarding sales agents — use these for `agent_name` in
 * `onboarding_lead_touches`, `onboarding_conversion_ledger`, and Zoho webhooks
 * (must align with `onboarding_sales_agents.display_name`).
 */
export const ONBOARDING_AGENT_DISPLAY_NAMES = [
  "Amit",
  "Samson",
  "Meghana",
] as const;

export type OnboardingAgentDisplayName =
  (typeof ONBOARDING_AGENT_DISPLAY_NAMES)[number];

/**
 * Zoho CRM sends owner full names in webhooks; we store canonical `display_name`.
 * Keys: normalized lowercase single spaces (trim + collapse whitespace).
 */
const ZOHO_FULL_NAME_TO_DISPLAY: Record<string, OnboardingAgentDisplayName> = {
  "amit agarwal": "Amit",
  "samson fernandes": "Samson",
  "meghana singh": "Meghana",
};

/**
 * Map Zoho `agent_name` (full name or first name only) to canonical display name.
 */
export function normalizeZohoAgentName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  const asKey = trimmed.toLowerCase();
  const fromFull = ZOHO_FULL_NAME_TO_DISPLAY[asKey];
  if (fromFull) return fromFull;
  const firstWord = trimmed.split(" ")[0] ?? trimmed;
  const match = ONBOARDING_AGENT_DISPLAY_NAMES.find(
    (n) => n.toLowerCase() === firstWord.toLowerCase(),
  );
  return match ?? trimmed;
}

/** Card order + stable ids for portraits (OnboardingPanel). */
export const ONBOARDING_AGENT_CARDS: readonly {
  id: string;
  name: OnboardingAgentDisplayName;
}[] = [
  { id: "amit", name: "Amit" },
  { id: "samson", name: "Samson" },
  { id: "meghana", name: "Meghana" },
] as const;

/**
 * Match a card’s display name to a stored `agent_name` (exact, case-insensitive,
 * or compound e.g. "Samson/Neha" → Samson).
 */
export function onboardingAgentNameMatches(
  cardDisplayName: string,
  storedAgentName: string,
): boolean {
  const stored = storedAgentName.trim().toLowerCase();
  if (!stored) return false;
  const card = cardDisplayName.trim().toLowerCase();
  const cardFirst = card.split(/\s+/)[0] ?? "";
  if (stored === card) return true;
  if (stored === cardFirst) return true;
  const storedFirst = stored.split(/[/,]/)[0]?.trim() ?? stored;
  if (storedFirst === card) return true;
  if (storedFirst === cardFirst) return true;
  const storedFirstWord = storedFirst.split(/\s+/)[0] ?? "";
  if (storedFirstWord === card) return true;
  if (storedFirstWord === cardFirst) return true;
  if (stored.startsWith(`${card}/`) || stored.startsWith(`${card} `)) {
    return true;
  }
  if (stored.startsWith(`${cardFirst}/`) || stored.startsWith(`${cardFirst} `)) {
    return true;
  }
  return false;
}
