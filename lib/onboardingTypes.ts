/**
 * lib/onboardingTypes.ts
 *
 * Shared TypeScript shapes for the Onboarding (Revenue) TV screen and
 * GET /api/onboarding.
 *
 * 2026-09-07 — the two-department model (Concierge vs Shop) was retired: the
 * Shop team left Zoho in June 2026 and the screen is now Onboarding-only (one
 * roster, rendered across the same two columns — see lib/onboardingAgents.ts).
 * Lead statuses follow the current Zoho picklist (lib/leadStatus.ts).
 *
 * Fields marked "This Month Cohort Math" use strict IST-calendar-month bounds
 * (getCurrentIstMonthUtcBounds) — NOT rolling 30-day windows.
 */

import { ZOHO_LEAD_STATUSES, type ZohoLeadStatus } from "./leadStatus";

export { ZOHO_LEAD_STATUSES };
export type { ZohoLeadStatus };

// ── Agent row ─────────────────────────────────────────────────────────────────

export interface OnboardingAgentRow {
  /** Roster id (lib/onboardingAgents.ts) — also the portrait key. */
  id: string;
  /** Card label (first name). */
  name: string;
  /** Optional portrait override (unused today — reserved for a DB roster). */
  photoUrl?: string | null;

  /** New leads created within the current IST calendar month (all statuses). */
  leadsCreatedThisMonth: number;
  /**
   * Closure count — deals created this IST month owned by this agent.
   * Not a currency field — agent cards show this number only.
   */
  totalConverted: number;
  /** New leads created today in IST (by created_at, not by activity timestamp). */
  leadsCreatedTodayIst: number;
  /** Alias of leadsCreatedThisMonth — kept for components that reference it. */
  leadsThisMonth?: number;
}

// ── Ledger row ────────────────────────────────────────────────────────────────

export interface OnboardingLedgerRow {
  id: string;
  clientName: string;
  /**
   * The day the closure counts on: `deals.closing_date` ("YYYY-MM-DD", an IST
   * calendar day — Zoho `Closing_Date`), falling back to the `created_at`
   * instant when no closing date is stored. Both parse through
   * `utcMillisFromDbTimestamp` (date-only → IST midnight).
   */
  recordedAt: string;
  /** Compact display name (getDisplayAgentName). */
  agentName: string;
}

// ── Business Vertical ─────────────────────────────────────────────────────────

/**
 * The four Indulge revenue verticals — identical to the Zoho `Business_Vertical`
 * picklist on Leads and to the CHECK constraint on `leads.business_vertical`.
 * (The Deals module spells the third one "Indulge Home"; deals carry no
 * vertical in this app.)
 */
export type BusinessVertical =
  | "Indulge Global"
  | "Indulge Shop"
  | "Indulge House"
  | "Indulge Legacy";

export const BUSINESS_VERTICALS: readonly BusinessVertical[] = [
  "Indulge Global",
  "Indulge Shop",
  "Indulge House",
  "Indulge Legacy",
] as const;

/**
 * The vertical the Onboarding screen's metrics are scoped to (user decision
 * 2026-09-07): agent cards, pipeline bars and the month tiles count ONLY
 * leads with this `business_vertical`. The trendline is the one deliberate
 * exception — it is a by-vertical breakdown, so it still draws all four.
 */
export const METRIC_BUSINESS_VERTICAL: BusinessVertical = "Indulge Global";

// ── Lead Trendline ────────────────────────────────────────────────────────────

/**
 * One data point in the month trendline chart.
 * Each field is the count of new leads for that vertical on this IST day.
 * Ordered oldest → newest so the SVG path draws left-to-right.
 */
export interface VerticalTrendPoint {
  /** IST calendar date "YYYY-MM-DD" */
  date: string;
  "Indulge Global": number;
  "Indulge Shop": number;
  "Indulge House": number;
  "Indulge Legacy": number;
}

// ── Zoho lead status health ───────────────────────────────────────────────────

/** Per-status count for one agent (current IST month cohort). */
export type AgentLeadStatusBreakdown = Record<ZohoLeadStatus, number> & {
  total: number;
};

export function emptyBreakdown(): AgentLeadStatusBreakdown {
  const bd = { total: 0 } as AgentLeadStatusBreakdown;
  for (const s of ZOHO_LEAD_STATUSES) bd[s] = 0;
  return bd;
}

/** Frozen zero breakdown for default props / fallbacks. */
export const EMPTY_BREAKDOWN: AgentLeadStatusBreakdown = Object.freeze(
  emptyBreakdown(),
) as AgentLeadStatusBreakdown;

/** Map from card display name → that agent's status breakdown */
export type LeadStatusByAgent = Record<string, AgentLeadStatusBreakdown>;

// ── Monthly lead stats (metric tiles) ────────────────────────────────────────

/**
 * Aggregate lead counts for the current IST calendar month, sourced directly
 * from the leads table — every METRIC_BUSINESS_VERTICAL row in the window,
 * automation owners included.
 *
 *   leads                — total rows where created_at falls in this IST month
 *   attended             — rows whose status shows the agent actioned the lead
 *                          (everything except New and Junk — isAttendedStatus)
 *   dealsClosedThisMonth — deals whose closing_date (fallback: created_at IST day)
 *                          falls in this IST month
 *   junk                 — rows normalised to Junk (Junk, Not Qualified, legacy Trash)
 */
export interface LeadMonthStats {
  leads: number;
  attended: number;
  dealsClosedThisMonth: number;
  junk: number;
}

// ── API payload ───────────────────────────────────────────────────────────────

/** Shape returned by GET /api/onboarding. */
export interface OnboardingApiPayload {
  /** One row per roster seat, in roster order (lib/onboardingAgents.ts). */
  agents: OnboardingAgentRow[];
  /** Newest-first closure feed from `deals`. */
  ledger: OnboardingLedgerRow[];
  /** Per-agent Zoho lead status breakdown for the current IST month. */
  leadStatusByAgent?: LeadStatusByAgent;
  /**
   * Daily new-lead counts split by business_vertical for the current IST
   * calendar month (day 1 → last day, future days zero-filled). Oldest → newest.
   */
  verticalTrendline?: VerticalTrendPoint[];
  /** Direct aggregate from the leads table for the current IST calendar month. */
  leadMonthStats?: LeadMonthStats;
}
