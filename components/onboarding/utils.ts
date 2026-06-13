/**
 * components/onboarding/utils.ts
 *
 * Pure helpers and constants for the Revenue Dashboard (Onboarding screen).
 * No React imports — safe in Server Components.
 *
 * Sections:
 *   1. Typography scale constants
 *   2. Data constants + fallback agents (re-exported from lib/onboardingAgents)
 *   3. Agent ordering helpers (per-department)
 *   4. Amount / date / lakh formatters
 *   5. Ledger helpers
 *   6. Portrait helpers
 */

import {
  CONCIERGE_AGENT_CARDS,
  SHOP_AGENT_CARDS,
  CONCIERGE_FALLBACK_AGENTS,
  SHOP_FALLBACK_AGENTS,
  getAgentDepartment,
} from "@/lib/onboardingAgents";
import { utcMillisFromDbTimestamp } from "@/lib/istDate";
import type {
  OnboardingAgentRow,
  OnboardingLedgerRow,
} from "@/lib/onboardingTypes";
import amitPortrait from "../../onboarding-agents-images/amit-sir.webp";
import harshPortrait from "../../onboarding-agents-images/harsh.webp";
import kaniishaPortrait from "../../onboarding-agents-images/kaniisha.webp";
import katyaPortrait from "../../onboarding-agents-images/katya.webp";
import meghanaPortrait from "../../onboarding-agents-images/meghana.webp";
import samsonPortrait from "../../onboarding-agents-images/samson.webp";
import vikramPortrait from "../../onboarding-agents-images/vikram.webp";

// ── IST display formatters (module-level singletons — never re-created per call) ──

/**
 * Formats a UTC timestamp to "22 March" (day + long month) in IST (Asia/Kolkata).
 * Mirrors the UTC→IST conversion used in lib/istDate and /api/tickets.
 */
const IST_LEDGER_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "long",
});

// ── 1. Typography scale ───────────────────────────────────────────────────────
// CSS variables defined in app/globals.css — single source of truth.
// Reference: var(--text-heading-xl), var(--text-heading-lg), etc.

/** "Revenue Dashboard" / "Onboarding" page heading → CSS var(--text-heading-xl) */
export const ONBOARDING_PAGE_TITLE_FONT = "var(--text-heading-xl)";

/** "Live Conversion Ledger" section heading → CSS var(--text-heading-lg) */
export const ONBOARDING_LEDGER_TITLE_FONT = "var(--text-heading-lg)";

/** Column header row (Client / Date / Agent) → CSS var(--text-ledger-header) */
export const ONBOARDING_LEDGER_HEADER_FONT = "var(--text-ledger-header)";

/** Cell text in each ledger data row → CSS var(--text-ledger-cell) */
export const ONBOARDING_LEDGER_CELL_FONT = "var(--text-ledger-cell)";

/** Department name heading above each column → CSS var(--text-dept-heading) */
export const DEPT_HEADING_FONT = "var(--text-dept-heading)";

// ── 2. Data constants & fallback agents ──────────────────────────────────────

/** Hard cap on rows kept in the scrolling ledger (memory safety for 24/7 TV). */
export const LIVE_LEDGER_MAX = 15;

// Re-export from lib/onboardingAgents — single source of truth
export { CONCIERGE_FALLBACK_AGENTS, SHOP_FALLBACK_AGENTS, getAgentDepartment };

// ── 3. Agent ordering ─────────────────────────────────────────────────────────

/**
 * Generic reorder: matches fromApi agents to the card spec order, filling
 * missing seats with zeroed fallback rows.
 */
function orderAgentsForDepartment(
  fromApi: OnboardingAgentRow[],
  cards: readonly { id: string; name: string }[],
  fallbacks: readonly (typeof CONCIERGE_FALLBACK_AGENTS)[number][],
): OnboardingAgentRow[] {
  const pool = [...fromApi];
  return cards.map((spec) => {
    const idxId = pool.findIndex((a) => a.id === spec.id);
    if (idxId >= 0) {
      const [a] = pool.splice(idxId, 1);
      return a!;
    }
    const idxName = pool.findIndex(
      (a) => a.name.trim().toLowerCase() === spec.name.toLowerCase(),
    );
    if (idxName >= 0) {
      const [a] = pool.splice(idxName, 1);
      return a!;
    }
    return (fallbacks.find((f) => f.id === spec.id) ??
      fallbacks[0]!) as OnboardingAgentRow;
  });
}

/** Reorders Concierge agents to match the fixed CONCIERGE_AGENT_CARDS display order. */
export function orderConciergeAgentsForDisplay(
  fromApi: OnboardingAgentRow[],
): OnboardingAgentRow[] {
  return orderAgentsForDepartment(
    fromApi,
    CONCIERGE_AGENT_CARDS,
    CONCIERGE_FALLBACK_AGENTS,
  );
}

/** Reorders Shop agents to match the fixed SHOP_AGENT_CARDS display order. */
export function orderShopAgentsForDisplay(
  fromApi: OnboardingAgentRow[],
): OnboardingAgentRow[] {
  return orderAgentsForDepartment(
    fromApi,
    SHOP_AGENT_CARDS,
    SHOP_FALLBACK_AGENTS,
  );
}

// ── 4. Formatters ─────────────────────────────────────────────────────────────

/**
 * Returns "22 March" (day + long month, no time, no year) from any timestamp string.
 * Always displays in IST (Asia/Kolkata) — matches the UTC→IST conversion used
 * throughout the project (lib/istDate, /api/tickets, /api/onboarding).
 * Returns "—" on parse failure.
 */
export function formatLedgerDate(iso: string): string {
  const ms = utcMillisFromDbTimestamp(iso);
  if (ms == null) return "—";
  return IST_LEDGER_DATE_FORMATTER.format(new Date(ms));
}

// ── 5. Ledger helpers ─────────────────────────────────────────────────────────

/** Returns a new array sorted newest-first by recordedAt. Non-mutating. */
export function sortLedgerNewestFirst(
  rows: OnboardingLedgerRow[],
): OnboardingLedgerRow[] {
  return [...rows].sort((a, b) => {
    const tb = utcMillisFromDbTimestamp(b.recordedAt) ?? 0;
    const ta = utcMillisFromDbTimestamp(a.recordedAt) ?? 0;
    return tb - ta;
  });
}

/**
 * Maps a raw Supabase INSERT payload (snake_case) to OnboardingLedgerRow.
 * Supports deals payload (`deal_name`, `created_at`) and legacy
 * conversion payload (`client_name`, `recorded_at`).
 */
export function ledgerRowFromInsertPayload(
  raw: Record<string, unknown>,
): OnboardingLedgerRow | null {
  if (raw == null) return null;
  const rowId =
    raw.deal_id != null ? String(raw.deal_id) : raw.id != null ? String(raw.id) : "";
  if (!rowId) return null;

  const recordedAt =
    typeof raw.created_at === "string"
      ? raw.created_at
      : raw.created_at != null
        ? String(raw.created_at)
        : typeof raw.recorded_at === "string"
          ? raw.recorded_at
          : raw.recorded_at != null
            ? String(raw.recorded_at)
            : "";
  if (!recordedAt) return null;

  const clientName =
    typeof raw.deal_name === "string"
      ? raw.deal_name
      : raw.deal_name != null
        ? String(raw.deal_name)
        : typeof raw.client_name === "string"
          ? raw.client_name
          : raw.client_name != null
            ? String(raw.client_name)
            : "";
  if (!clientName) return null;

  const agentName =
    typeof raw.agent_name === "string"
      ? raw.agent_name
      : String(raw.agent_name ?? "");
  if (!agentName.trim()) return null;

  return {
    id: rowId,
    clientName,
    recordedAt,
    agentName,
    // Derive department from agent name — no DB column needed
    department: getAgentDepartment(agentName),
  };
}

// ── 6. Portrait helpers ───────────────────────────────────────────────────────

function bundledImageSrc(img: string | { src: string }): string {
  return typeof img === "string" ? img : img.src;
}

const LOCAL_ONBOARDING_PORTRAITS: Record<
  "amit" | "samson" | "meghana" | "kaniisha" | "vikram" | "katya" | "harsh",
  string
> = {
  amit: bundledImageSrc(amitPortrait),
  samson: bundledImageSrc(samsonPortrait),
  meghana: bundledImageSrc(meghanaPortrait),
  kaniisha: bundledImageSrc(kaniishaPortrait),
  vikram: bundledImageSrc(vikramPortrait),
  katya: bundledImageSrc(katyaPortrait),
  harsh: bundledImageSrc(harshPortrait),
};

function agentPortraitPresetKey(
  agent: OnboardingAgentRow,
): "amit" | "samson" | "meghana" | "kaniisha" | "vikram" | "katya" | "harsh" | null {
  const id = agent.id.trim().toLowerCase();
  if (
    id === "amit" ||
    id === "samson" ||
    id === "meghana" ||
    id === "kaniisha" ||
    id === "vikram" ||
    id === "katya" ||
    id === "harsh"
  ) {
    return id;
  }
  const n = agent.name.trim().toLowerCase();
  if (n === "amit") return "amit";
  if (n === "samson") return "samson";
  if (n === "meghana") return "meghana";
  if (n === "kaniisha") return "kaniisha";
  if (n === "vikram") return "vikram";
  if (n === "katya") return "katya";
  if (n === "harsh") return "harsh";
  return null;
}

/**
 * Resolves the best available portrait src for an agent:
 *   1. photoUrl from database (takes priority)
 *   2. Bundled static image for known concierge agents
 *   3. Dicebear avatar fallback (seeded by name / id)
 */
export function agentPortraitSrc(agent: OnboardingAgentRow): string {
  if (agent.photoUrl) return agent.photoUrl;
  const presetKey = agentPortraitPresetKey(agent);
  if (presetKey) return LOCAL_ONBOARDING_PORTRAITS[presetKey];
  const q = new URLSearchParams({
    seed: agent.name || agent.id,
    backgroundColor: "transparent",
  });
  return `https://api.dicebear.com/7.x/avataaars/svg?${q.toString()}`;
}
