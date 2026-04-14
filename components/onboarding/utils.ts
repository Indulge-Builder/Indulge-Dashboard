/**
 * components/onboarding/utils.ts
 *
 * Pure helpers and constants for the Onboarding screen.
 * No React imports — safe to import in Server Components or other non-client files.
 *
 * Sections:
 *   1. Typography scale constants (CSS clamp strings)
 *   2. Data constants (LIVE_LEDGER_MAX, FALLBACK_AGENTS)
 *   3. Agent ordering helper
 *   4. Amount / date formatters
 *   5. Ledger helpers (sort, Realtime INSERT parser)
 *   6. Portrait helpers (preset key lookup, local image map, src resolver)
 */

import { ONBOARDING_AGENT_CARDS } from "@/lib/onboardingAgents";
import type { OnboardingAgentRow, OnboardingLedgerRow } from "@/lib/onboardingTypes";
import amitPortrait    from "../../onboarding-agents-images/amit-sir.png";
import meghanaPortrait from "../../onboarding-agents-images/meghana.png";
import samsonPortrait  from "../../onboarding-agents-images/samson.png";

// ── 1. Typography scale ───────────────────────────────────────────────────────
// All clamp() strings use min(vmin, vh) as the middle term so they scale
// smoothly on the TV (ultrawide) without jumping at breakpoints.

/** Metric box heading (Attempted / Closures / Leads) */
export const ONBOARDING_CARD_TITLE_FONT =
  "clamp(1.15rem, min(2.85vmin, 3.3vh), 3.85rem)";

/** Agent first+last name inside the name badge */
export const ONBOARDING_AGENT_NAME_FONT =
  "clamp(1.5rem, min(3.85vmin, 4.4vh), 5.25rem)";

/** Large numeric value in each stat box */
export const ONBOARDING_METRIC_VALUE_FONT =
  "clamp(1.5rem, min(4.4vmin, 5.2vh), 5.75rem)";

/** Sub-label under the metric heading, e.g. "(This Month)" */
export const ONBOARDING_METRIC_SUBTITLE_FONT =
  "clamp(1.25rem, min(3.5vmin, 3.95vh), 2.45rem)";

/** Tailwind class string shared by every metric subtitle */
export const ONBOARDING_METRIC_SUBTITLE_CLASS =
  "font-inter font-semibold uppercase leading-snug tracking-[0.22em]";

/** "Onboarding" page heading */
export const ONBOARDING_PAGE_TITLE_FONT =
  "clamp(2rem, min(4.6vmin, 5.9vh), 4.4rem)";

/** "Live Conversion Ledger" section heading */
export const ONBOARDING_LEDGER_TITLE_FONT =
  "clamp(1.65rem, min(3.85vmin, 4.9vh), 3.85rem)";

/** Column header row (Client / Amount / Date / Agent) */
export const ONBOARDING_LEDGER_HEADER_FONT =
  "clamp(1.05rem, min(2.35vmin, 2.85vh), 2.05rem)";

/** Cell text in each ledger data row */
export const ONBOARDING_LEDGER_CELL_FONT =
  "clamp(1.15rem, min(2.65vmin, 3.25vh), 3.5rem)";

// ── 2. Data constants ─────────────────────────────────────────────────────────

/** Hard cap on rows kept in the scrolling ledger (memory safety for 24/7 TV). */
export const LIVE_LEDGER_MAX = 15;

/**
 * Used when /api/onboarding fails so the screen always shows the three
 * sales seats with zeroed stats instead of a blank panel.
 */
export const FALLBACK_AGENTS: OnboardingAgentRow[] = ONBOARDING_AGENT_CARDS.map(
  (s) => ({
    id:               s.id,
    name:             s.name,
    photoUrl:         null,
    totalAttempted:   0,
    totalConverted:   0,
    leadsAttendToday: 0,
  }),
);

// ── 3. Agent ordering ─────────────────────────────────────────────────────────

/**
 * Reorders API agents to match the fixed ONBOARDING_AGENT_CARDS display order.
 * Falls back to zeroed FALLBACK_AGENTS for any seat not present in the API response.
 * Matching is tried by id first, then by name (case-insensitive).
 */
export function orderAgentsForDisplay(
  fromApi: OnboardingAgentRow[],
): OnboardingAgentRow[] {
  const pool = [...fromApi];
  return ONBOARDING_AGENT_CARDS.map((spec) => {
    const idxId = pool.findIndex((a) => a.id === spec.id);
    if (idxId >= 0) {
      const [a] = pool.splice(idxId, 1);
      return a;
    }
    const idxName = pool.findIndex(
      (a) => a.name.trim().toLowerCase() === spec.name.toLowerCase(),
    );
    if (idxName >= 0) {
      const [a] = pool.splice(idxName, 1);
      return a;
    }
    return FALLBACK_AGENTS.find((f) => f.id === spec.id)!;
  });
}

// ── 4. Formatters ─────────────────────────────────────────────────────────────

/**
 * Converts a raw rupee amount to a "₹N L" display string.
 * 1 Lakh = ₹1,00,000. Trailing zeros stripped after decimal.
 * Examples: 200000 → "₹2 L", 250000 → "₹2.5 L"
 */
export function formatAmountLakh(amount: number): string {
  const lakhs = amount / 100_000;
  if (!Number.isFinite(lakhs)) return "—";
  if (lakhs === 0) return "₹0 L";
  const str =
    lakhs % 1 === 0 ? String(lakhs) : lakhs.toFixed(2).replace(/\.?0+$/, "");
  return `₹${str} L`;
}

/**
 * Returns "22 March" (day + long month, no time, no year) from any ISO string.
 * Returns "—" on parse failure.
 */
export function formatLedgerDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  } catch {
    return "—";
  }
}

// ── 5. Ledger helpers ─────────────────────────────────────────────────────────

/** Returns a new array sorted newest-first by recordedAt. Non-mutating. */
export function sortLedgerNewestFirst(
  rows: OnboardingLedgerRow[],
): OnboardingLedgerRow[] {
  return [...rows].sort(
    (a, b) =>
      new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );
}

/**
 * Maps a raw Supabase INSERT payload (snake_case) to OnboardingLedgerRow.
 * Returns null for rows with missing or non-finite amounts / timestamps.
 */
export function ledgerRowFromInsertPayload(
  raw: Record<string, unknown>,
): OnboardingLedgerRow | null {
  if (raw == null || typeof raw.id === "undefined") return null;

  const amountRaw = raw.amount;
  const amount =
    typeof amountRaw === "number"
      ? amountRaw
      : typeof amountRaw === "string"
        ? parseFloat(amountRaw)
        : NaN;
  if (!Number.isFinite(amount)) return null;

  const recordedAt =
    typeof raw.recorded_at === "string"
      ? raw.recorded_at
      : raw.recorded_at != null
        ? String(raw.recorded_at)
        : "";
  if (!recordedAt) return null;

  const q = raw.queendom_name;
  const assignedTo =
    q != null && String(q).trim() !== "" ? String(q).trim() : "";

  return {
    id:         String(raw.id),
    clientName: typeof raw.client_name === "string"
      ? raw.client_name
      : String(raw.client_name ?? ""),
    amount,
    recordedAt,
    assignedTo,
    agentName: typeof raw.agent_name === "string"
      ? raw.agent_name
      : String(raw.agent_name ?? ""),
  };
}

// ── 6. Portrait helpers ───────────────────────────────────────────────────────

/** Resolves a Next.js static-import image object (or plain string) to its src URL. */
function bundledImageSrc(img: string | { src: string }): string {
  return typeof img === "string" ? img : img.src;
}

const LOCAL_ONBOARDING_PORTRAITS: Record<
  "amit" | "samson" | "meghana",
  string
> = {
  amit:    bundledImageSrc(amitPortrait),
  samson:  bundledImageSrc(samsonPortrait),
  meghana: bundledImageSrc(meghanaPortrait),
};

/**
 * Returns the preset key ("amit" | "samson" | "meghana") for an agent row
 * by matching on id first, then on display name (case-insensitive).
 * Returns null for agents not in the preset map.
 */
function agentPortraitPresetKey(
  agent: OnboardingAgentRow,
): "amit" | "samson" | "meghana" | null {
  const id = agent.id.trim().toLowerCase();
  if (id === "amit" || id === "samson" || id === "meghana") return id;
  const n = agent.name.trim().toLowerCase();
  if (n === "amit")    return "amit";
  if (n === "samson")  return "samson";
  if (n === "meghana") return "meghana";
  return null;
}

/**
 * Resolves the best available portrait src for an agent:
 *   1. photoUrl from database (takes priority)
 *   2. Bundled static image from LOCAL_ONBOARDING_PORTRAITS
 *   3. Dicebear avatar fallback (seeded by name / id)
 */
export function agentPortraitSrc(agent: OnboardingAgentRow): string {
  if (agent.photoUrl) return agent.photoUrl;
  const presetKey = agentPortraitPresetKey(agent);
  if (presetKey) return LOCAL_ONBOARDING_PORTRAITS[presetKey];
  const q = new URLSearchParams({
    seed:            agent.name || agent.id,
    backgroundColor: "transparent",
  });
  return `https://api.dicebear.com/7.x/avataaars/svg?${q.toString()}`;
}
