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

// ── Pipeline ──────────────────────────────────────────────────────────────────

/**
 * Ordered lead-lifecycle stages used in the Pipeline Bar Chart.
 * Order matches the expected funnel left → right.
 */
export type PipelineStatus =
  | "New"
  | "Attempted"
  | "In Discussion"
  | "Won"
  | "Lost";

export const PIPELINE_STATUSES: readonly PipelineStatus[] = [
  "New",
  "Attempted",
  "In Discussion",
  "Won",
  "Lost",
] as const;

/**
 * Count of leads at each funnel stage for a single department.
 * All values are non-negative integers; 0 when no leads at that stage.
 */
export interface PipelineStatusCounts {
  New: number;
  Attempted: number;
  "In Discussion": number;
  Won: number;
  Lost: number;
}

export const EMPTY_PIPELINE: PipelineStatusCounts = {
  New: 0,
  Attempted: 0,
  "In Discussion": 0,
  Won: 0,
  Lost: 0,
};

// ── Per-department rollup ─────────────────────────────────────────────────────

/**
 * Aggregated scorecard for one department.
 * All monetary values are in Indian Rupees (raw numeric).
 * All date-bound metrics use This Month Cohort Math.
 */
export interface DepartmentStats {
  department: Department;
  /** Sum of deal amounts in onboarding_conversion_ledger this IST month (₹). */
  totalRupeesClosedThisMonth: number;
  /** Convenience: totalRupeesClosedThisMonth / 100_000 (pre-computed for display). */
  totalLakhsClosedThisMonth: number;
  /** Lead-status funnel counts for PipelineBar. */
  pipeline: PipelineStatusCounts;
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

  // ── Legacy fields (kept for backward compat with current API route) ──────

  /** @legacy New leads created this IST month. Same count source as leadsThisMonth. */
  totalAttempted: number;
  /**
   * @legacy Closure count (won deals this IST month from ledger / Zoho).
   * Not a currency field — agent cards show this number only.
   * Used for win-shimmer detection.
   */
  totalConverted: number;
  /** @legacy New leads created today (IST). Mirrors leadsThisMonth for the current day only. */
  leadsAttendToday: number;

  // ── This Month Cohort Math fields (populated by updated API route) ────────

  /**
   * Leads created within the current IST calendar month (Zoho → webhook).
   * Source: onboarding_lead_touches.created_at within getCurrentIstMonthUtcBounds().
   */
  leadsThisMonth?: number;

  /**
   * Sum of won deal amounts (₹) within the current IST calendar month (raw rupees).
   * Populated by `/api/onboarding` for rollups; agent cards use `totalConverted` (count) only.
   */
  closedLakhsThisMonth?: number;

  /**
   * Per-agent lead pipeline breakdown by funnel stage.
   * Optional — derived from totalAttempted / totalConverted as fallback
   * until the API route is updated to provide per-agent pipeline counts.
   */
  pipeline?: PipelineStatusCounts;
}

// ── Ledger row ────────────────────────────────────────────────────────────────

export interface OnboardingLedgerRow {
  id: string;
  clientName: string;
  /** ISO 8601 UTC string from created_at/recorded_at column. */
  recordedAt: string;
  /**
   * @legacy Queendom name or empty string (pre-department era).
   * Kept so existing mapLedgerRows() in route.ts compiles unchanged.
   */
  assignedTo: string;
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
 * A single data point in the 7–14 day lead-velocity chart.
 *
 * `date`            — IST calendar date string "YYYY-MM-DD" (X-axis label)
 * `conciergeLeads`  — new leads (created_at) where getAgentDepartment() === "concierge"
 * `shopLeads`       — new leads (created_at) where getAgentDepartment() === "shop"
 *
 * Both counts include ALL statuses (not just "Attempted") because the chart
 * shows raw daily volume, not funnel stage.
 * Points are ordered oldest → newest so the SVG path draws left-to-right.
 */
export interface LeadTrendPoint {
  /** IST calendar date "YYYY-MM-DD" — used as unique key and X-axis label */
  date: string;
  conciergeLeads: number;
  shopLeads: number;
}

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
  | "Attempted"
  | "In Discussion"
  | "Nurturing"
  | "Junk"
  | "Qualified";

/** Per-status count for one agent */
export interface AgentLeadStatusBreakdown {
  New: number;
  Attempted: number;
  "In Discussion": number;
  Nurturing: number;
  Junk: number;
  Qualified: number;
  total: number;
}

export const EMPTY_BREAKDOWN: AgentLeadStatusBreakdown = {
  New: 0,
  Attempted: 0,
  "In Discussion": 0,
  Nurturing: 0,
  Junk: 0,
  Qualified: 0,
  total: 0,
};

/** Map from canonical agent name → their status breakdown */
export type LeadStatusByAgent = Record<string, AgentLeadStatusBreakdown>;

/** Team-level daily "attended" counts for the velocity chart */
export interface TeamAttendedDay {
  date: string; // "YYYY-MM-DD" in IST
  onboarding: number; // sum of non-New leads for onboarding agents that day
  shop: number; // sum of non-New leads for shop agents that day
}

// ── Performance graph ─────────────────────────────────────────────────────────

/**
 * One data point per IST calendar day for the PerformanceLineGraph.
 * Derived in OnboardingPanel by merging leadTrendline + teamAttendedTrend
 * + per-day conversion counts from the ledger.
 */
export interface PerformanceDayPoint {
  /** IST calendar date "YYYY-MM-DD" — X-axis key and label */
  date: string;
  onboarding: { leads: number; attended: number; converted: number };
  shop:        { leads: number; attended: number; converted: number };
}

/**
 * Current-period aggregate totals used to calculate the Performance Score
 * for each team. Junk is sourced from leadStatusByAgent; the rest are summed
 * from the PerformanceDayPoint time series.
 */
export interface PerformanceTotals {
  onboarding: { leads: number; attended: number; converted: number; junk: number };
  shop:       { leads: number; attended: number; converted: number; junk: number };
}

// ── Monthly lead stats (metric tiles) ────────────────────────────────────────

/**
 * Aggregate lead counts for the current IST calendar month, sourced directly
 * from the leads table (all rows, not filtered by agent name).
 *
 *   leads     — total rows where created_at falls in this IST month
 *   attended  — rows where latest_status IN (New | Attempted | In Discussion)
 *   converted — rows where latest_status = Qualified
 *   junk      — all remaining rows (Nurturing, Junk, Lost, Trash, unknown…)
 */
export interface LeadMonthStats {
  leads:     number;
  attended:  number;
  converted: number;
  junk:      number;
}

// ── API payload ───────────────────────────────────────────────────────────────

/**
 * Shape returned by GET /api/onboarding.
 *
 * `agents` and `ledger` are the legacy flat arrays (backward compat).
 * `departments` is the new dual-department rollup — absent from the current
 * route, populated after Step 3.
 * `leadTrendline` powers the Lead Velocity SVG chart — 14 daily data points.
 */
export interface OnboardingApiPayload {
  agents: OnboardingAgentRow[];
  ledger: OnboardingLedgerRow[];
  /**
   * Per-department aggregated stats + agent cards + pipeline.
   * Strict shape: once present, all inner fields are required and non-null.
   */
  departments?: {
    concierge: DepartmentStats;
    shop: DepartmentStats;
  };
  /**
   * Daily lead-touch counts for the last 14 IST calendar days (including today).
   * Ordered oldest → newest. Empty array until the API route is updated.
   * Both department counts can be 0 for days with no activity.
   */
  leadTrendline?: LeadTrendPoint[];

  /** Per-agent Zoho lead status breakdown for current IST month. */
  leadStatusByAgent?: LeadStatusByAgent;

  /** Team-level daily "attended" (status != New) counts for last 14 IST days. */
  teamAttendedTrend?: TeamAttendedDay[];

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
