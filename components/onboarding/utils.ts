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

// ── 1. Typography scale ───────────────────────────────────────────────────────

/** "Revenue Dashboard" / "Onboarding" page heading */
export const ONBOARDING_PAGE_TITLE_FONT =
  "clamp(2rem, min(4.6vmin, 5.9vh), 4.4rem)";

/** "Live Conversion Ledger" section heading */
export const ONBOARDING_LEDGER_TITLE_FONT =
  "clamp(1.65rem, min(3.85vmin, 4.9vh), 3.85rem)";

/** Column header row (Client / Date / Agent) */
export const ONBOARDING_LEDGER_HEADER_FONT =
  "clamp(1.05rem, min(2.35vmin, 2.85vh), 2.05rem)";

/** Cell text in each ledger data row */
export const ONBOARDING_LEDGER_CELL_FONT =
  "clamp(1.15rem, min(2.65vmin, 3.25vh), 3.5rem)";

// ── Compact-card scale (DepartmentColumn) ────────────────────────────────────

/**
 * Agent name on compact cards — matches TV dashboard headline tier with
 * ledger headers / dept hero type (same clamp grammar as onboarding scale).
 */
export const COMPACT_AGENT_NAME_FONT =
  "clamp(0.95rem, min(2.35vmin, 2.85vh), 2.75rem)";

/** Metric label inside each chip (Today / Month / Closed) */
export const COMPACT_METRIC_LABEL_FONT =
  "clamp(0.55rem, min(1.3vmin, 1.6vh), 1.5rem)";

/** Metric value inside each chip */
export const COMPACT_METRIC_VALUE_FONT =
  "clamp(0.95rem, min(2.4vmin, 2.9vh), 3rem)";

/** Metric value inside the 3-up horizontal stat tiles (slightly tighter for density) */
export const COMPACT_METRIC_TILE_VALUE_FONT =
  "clamp(0.78rem, min(2.05vmin, 2.45vh), 2.35rem)";

/** Legend labels under the pipeline bar — Queendom-style label tier */
export const COMPACT_PIPELINE_RAIL_CAPTION_FONT =
  "clamp(18px, min(2.6vmin, 2.8vw), 36px)";

/** Department name heading above each column */
export const DEPT_HEADING_FONT = "clamp(1.25rem, min(2.8vmin, 3.3vh), 3.2rem)";

/** Total lakhs hero number in the department column header */
export const DEPT_LAKHS_HERO_FONT = "clamp(1.8rem, min(4.2vmin, 5vh), 5.5rem)";

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
 * Formats a pre-divided lakhs value (i.e. already divided by 100_000) for display.
 * Use for DepartmentStats.totalLakhsClosedThisMonth which is pre-computed.
 * Examples: 2.5 → "₹2.5 L", 12 → "₹12 L"
 */
export function formatLakhsDisplay(lakhs: number): string {
  if (!Number.isFinite(lakhs) || lakhs === 0) return "₹0 L";
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

  const q = raw.queendom_name;
  const assignedTo =
    q != null && String(q).trim() !== "" ? String(q).trim() : "";

  const agentName =
    typeof raw.agent_name === "string"
      ? raw.agent_name
      : String(raw.agent_name ?? "");
  if (!agentName.trim()) return null;

  return {
    id: rowId,
    clientName,
    recordedAt,
    assignedTo,
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
