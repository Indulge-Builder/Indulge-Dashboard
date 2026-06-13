/**
 * lib/onboardingTypes.ts
 *
 * Shared TypeScript shapes for the Revenue Dashboard TV screen and
 * GET /api/onboarding.
 *
 * Versioning note
 * ───────────────
 * Fields marked "Legacy" pre-date the dual-department overhaul and are kept
 * so the existing /api/onboarding route compiles unmodified until Step 3
 * updates it. Once the route is updated, all optional (*?) new fields become
 * de-facto required at runtime.
 *
 * Fields marked "This Month Cohort Math" use strict IST-calendar-month bounds
 * (getCurrentIstMonthUtcBounds) — NOT rolling 30-day windows.
 */

// ── Department ────────────────────────────────────────────────────────────────

/**
 * Two revenue departments shown on the TV screen.
 *   concierge — Samson, Amit, Meghana (Concierge Onboarding)
 *   shop      — Vikram, Katya, Harsh  (Shop Sales)
 */
export type Department = "concierge" | "shop";

// ── Per-department rollup ─────────────────────────────────────────────────────
// (The old PipelineStatus/PipelineStatusCounts funnel system was collapsed in
// dry-audit D6 — the UI renders ZohoLeadStatus breakdowns below; the only
// funnel consumer is the parked _unmounted/AgentVerticalBarChart, which now
// carries its own local copy.)

/**
 * Aggregated scorecard for one department.
 * All date-bound metrics use This Month Cohort Math.
 */
export interface DepartmentStats {
  department: Department;
  /** Ordered agent cards belonging to this department. */
  agents: OnboardingAgentRow[];
}

// ── Agent row ─────────────────────────────────────────────────────────────────

export interface OnboardingAgentRow {
  id: string;
  name: string;
  /** Optional portrait override from onboarding_sales_agents.photo_url */
  photoUrl?: string | null;

  /**
   * Which revenue team this agent belongs to.
   * Optional during migration — populated by updated /api/onboarding (Step 3).
   * Default assumed: "concierge" for backward compat.
   */
  department?: Department;

  // ── Scorecard fields ──────────────────────────────────────────────────────

  /** New leads created within the current IST calendar month (all statuses). */
  leadsCreatedThisMonth: number;
  /**
   * Closure count — won deals this IST month from ledger / Zoho.
   * Not a currency field — agent cards show this number only.
   * Used for win-shimmer detection.
   */
  totalConverted: number;
  /** New leads created today in IST (by created_at, not by activity timestamp). */
  leadsCreatedTodayIst: number;

  // ── This Month Cohort Math fields (populated by updated API route) ────────

  /**
   * Leads created within the current IST calendar month (Zoho → webhook).
   * Source: leads.created_at within getCurrentIstMonthUtcBounds().
   * Alias of leadsCreatedThisMonth — kept for any components that reference it.
   */
  leadsThisMonth?: number;
}

// ── Ledger row ────────────────────────────────────────────────────────────────

export interface OnboardingLedgerRow {
  id: string;
  clientName: string;
  /** ISO 8601 UTC string from created_at/recorded_at column. */
  recordedAt: string;
  agentName: string;
  /**
   * Revenue department this deal belongs to.
   * Derived at query time by getAgentDepartment(agentName) — no DB column needed.
   * Optional during migration; populated by updated /api/onboarding (Step 3).
   */
  department?: Department;
}

// ── Business Vertical ─────────────────────────────────────────────────────────

/**
 * The four Indulge revenue verticals. Visual hierarchy (highest → lowest lead
 * volume): Global > Shop > House > Legacy.
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

// ── Lead Trendline ────────────────────────────────────────────────────────────

/**
 * One data point in the 7-day vertical trendline chart.
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

/** The 6 Zoho lead statuses relevant to the onboarding pipeline */
export type ZohoLeadStatus =
  | "New"
  | "Touched"
  | "In Discussion"
  | "Nurturing"
  | "Junk"
  | "Qualified";

/** Per-status count for one agent */
export interface AgentLeadStatusBreakdown {
  New: number;
  Touched: number;
  "In Discussion": number;
  Nurturing: number;
  Junk: number;
  Qualified: number;
  total: number;
}

export const EMPTY_BREAKDOWN: AgentLeadStatusBreakdown = {
  New: 0,
  Touched: 0,
  "In Discussion": 0,
  Nurturing: 0,
  Junk: 0,
  Qualified: 0,
  total: 0,
};

/** Map from canonical agent name → their status breakdown */
export type LeadStatusByAgent = Record<string, AgentLeadStatusBreakdown>;

// ── Monthly lead stats (metric tiles) ────────────────────────────────────────

/**
 * Aggregate lead counts for the current IST calendar month, sourced directly
 * from the leads table (all rows, not filtered by agent name).
 *
 *   leads               — total rows where created_at falls in this IST month
 *                         (system agents excluded)
 *   attended            — rows where latest_status IN (New | Touched | In Discussion)
 *   dealsClosedThisMonth — count of rows in the deals table this IST month
 *   junk                — all remaining rows (Nurturing, Junk, Lost, Trash, unknown…)
 */
export interface LeadMonthStats {
  leads:                number;
  attended:             number;
  dealsClosedThisMonth: number;
  junk:                 number;
}

// ── API payload ───────────────────────────────────────────────────────────────

/**
 * Shape returned by GET /api/onboarding.
 *
 * `agents` and `ledger` are the legacy flat arrays (backward compat).
 * `departments` is the new dual-department rollup — absent from the current
 * route, populated after Step 3.
 */
export interface OnboardingApiPayload {
  agents: OnboardingAgentRow[];
  ledger: OnboardingLedgerRow[];
  /**
   * Per-department aggregated stats + agent cards.
   * Strict shape: once present, all inner fields are required and non-null.
   */
  departments?: {
    concierge: DepartmentStats;
    shop: DepartmentStats;
  };
  /** Per-agent Zoho lead status breakdown for current IST month. */
  leadStatusByAgent?: LeadStatusByAgent;

  /**
   * Daily new-lead counts split by business_vertical for the current IST calendar
   * month (day 1 → last day, with future days zero-filled). Powers the 4-line
   * PerformanceLineGraph. Ordered oldest → newest.
   */
  verticalTrendline?: VerticalTrendPoint[];

  /**
   * Direct aggregate from the leads table for the current IST calendar month.
   * Powers the 4 metric tiles above the PerformanceLineGraph.
   * Not filtered by known agent names — includes every row in the table.
   */
  leadMonthStats?: LeadMonthStats;
}
