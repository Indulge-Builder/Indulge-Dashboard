/**
 * components/onboarding/utils.ts
 *
 * Pure helpers and constants for the Onboarding (Revenue) screen.
 * No React imports — safe in Server Components.
 *
 * Sections:
 *   1. Typography scale constants
 *   2. Data constants + fallback agents (re-exported from lib/onboardingAgents)
 *   3. Agent ordering helpers (per-column)
 *   4. Date formatters
 *   5. Ledger helpers
 *   6. Portrait helpers
 */

import {
  ONBOARDING_FALLBACK_AGENTS,
  cardsForColumn,
  type AgentColumn,
} from "@/lib/onboardingAgents";
import { utcMillisFromDbTimestamp } from "@/lib/istDate";
import type {
  OnboardingAgentRow,
  OnboardingLedgerRow,
} from "@/lib/onboardingTypes";
import kaniishaPortrait from "../../onboarding-agents-images/kaniisha.webp";
import samsonPortrait from "../../onboarding-agents-images/samson.webp";

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

/** Section headings (Monthly Target / Conversion Ledger) → CSS var(--text-heading-lg) */
export const ONBOARDING_LEDGER_TITLE_FONT = "var(--text-heading-lg)";

/** Column header row (Client / Date / Agent) → CSS var(--text-ledger-header) */
export const ONBOARDING_LEDGER_HEADER_FONT = "var(--text-ledger-header)";

/** Cell text in each ledger data row → CSS var(--text-ledger-cell) */
export const ONBOARDING_LEDGER_CELL_FONT = "var(--text-ledger-cell)";

/** Column heading ("Onboarding") above each agent column → CSS var(--text-dept-heading) */
export const DEPT_HEADING_FONT = "var(--text-dept-heading)";

// ── 2. Data constants & fallback agents ──────────────────────────────────────

/** Hard cap on rows kept in the scrolling ledger (memory safety for 24/7 TV). */
export const LIVE_LEDGER_MAX = 15;

// Re-export from lib/onboardingAgents — single source of truth
export { ONBOARDING_FALLBACK_AGENTS };

// ── 3. Agent ordering ─────────────────────────────────────────────────────────

/**
 * Picks the seats of one column from the API's flat agent list, in roster
 * order, filling any missing seat with its zeroed fallback row.
 */
export function orderAgentsForColumn(
  fromApi: OnboardingAgentRow[],
  column: AgentColumn,
): OnboardingAgentRow[] {
  return cardsForColumn(column).map((spec) => {
    const byId = fromApi.find((a) => a.id === spec.id);
    if (byId) return byId;
    const byName = fromApi.find(
      (a) => a.name.trim().toLowerCase() === spec.name.toLowerCase(),
    );
    if (byName) return byName;
    return (ONBOARDING_FALLBACK_AGENTS.find((f) => f.id === spec.id) ??
      ONBOARDING_FALLBACK_AGENTS[0]!) as OnboardingAgentRow;
  });
}

// ── 4. Formatters ─────────────────────────────────────────────────────────────

/**
 * Returns "22 March" (day + long month, no time, no year) from any timestamp string.
 * Always displays in IST (Asia/Kolkata). Returns "—" on parse failure.
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
 * Supports deals payload (`deal_name`, `closing_date`, `created_at`) and legacy
 * conversion payload (`client_name`, `recorded_at`).
 */
export function ledgerRowFromInsertPayload(
  raw: Record<string, unknown>,
): OnboardingLedgerRow | null {
  if (raw == null) return null;
  const rowId =
    raw.deal_id != null ? String(raw.deal_id) : raw.id != null ? String(raw.id) : "";
  if (!rowId) return null;

  // Closures count on closing_date (IST day) when the webhook supplied one.
  const recordedAt =
    typeof raw.closing_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.closing_date)
      ? raw.closing_date
      : typeof raw.created_at === "string"
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

  return { id: rowId, clientName, recordedAt, agentName };
}

// ── 6. Portrait helpers ───────────────────────────────────────────────────────

function bundledImageSrc(img: string | { src: string }): string {
  return typeof img === "string" ? img : img.src;
}

/**
 * Bundled portraits keyed by roster id. To add one: drop
 * `onboarding-agents-images/<id>.webp` in the repo, import it above and add
 * the key here. Seats without a file show a blank black frame (Nandini,
 * Kabeer and Surbhi as of 2026-09-07 — photos still to be supplied).
 */
const LOCAL_ONBOARDING_PORTRAITS: Readonly<Record<string, string>> = {
  samson: bundledImageSrc(samsonPortrait),
  kaniisha: bundledImageSrc(kaniishaPortrait),
};

/**
 * Resolves the portrait src for an agent, or null when there is none:
 *   1. photoUrl from the API (takes priority)
 *   2. Bundled static image for the roster id / first name
 *   3. null — the card renders a blank black frame (user decision 2026-09-07:
 *      no placeholder avatars while the new agents' photos are pending).
 */
export function agentPortraitSrc(agent: OnboardingAgentRow): string | null {
  if (agent.photoUrl) return agent.photoUrl;
  const id = agent.id.trim().toLowerCase();
  const first = agent.name.trim().toLowerCase().split(/[\s/,]/)[0] ?? "";
  return LOCAL_ONBOARDING_PORTRAITS[id] ?? LOCAL_ONBOARDING_PORTRAITS[first] ?? null;
}
