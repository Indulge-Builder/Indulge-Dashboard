/**
 * types/index.ts — Central type registry for the Indulge Live Dashboard.
 *
 * All components should import from "@/types" instead of scattered lib/ files.
 * The lib/ source files are NOT modified — API route imports remain stable.
 *
 * Sections:
 *   1. Re-exports from lib/types.ts        (core domain: tickets, agents, jokers)
 *   2. Re-exports from lib/onboardingTypes.ts
 *   3. Re-export from lib/ticketAggregation.ts (TicketRowMinimal — Realtime patches)
 *   4. New shared UI types previously defined inline in multiple components
 */

// ─── 1. Core domain types ─────────────────────────────────────────────────────
// Import first so MemberApiResponse (section 4) can reference MemberStats.
import type {
  MemberStats,
  TicketStats,
  JokerStats,
  AgentStats,
  QueenStats,
  SpecialDate,
  RenewalDueClient,
} from "@/lib/types";

export type {
  MemberStats,
  TicketStats,
  JokerStats,
  AgentStats,
  QueenStats,
  SpecialDate,
  RenewalDueClient,
};

// ─── 2. Onboarding types ──────────────────────────────────────────────────────
export type {
  OnboardingAgentRow,
  OnboardingLedgerRow,
  OnboardingApiPayload,
} from "@/lib/onboardingTypes";

// ─── 3. Realtime-patch row shape ──────────────────────────────────────────────
export type { TicketRowMinimal } from "@/lib/ticketAggregation";

// ─── 4. Shared UI types (previously inline in multiple components) ─────────────

/**
 * Overdue ticket item shape returned by GET /api/tickets/overdue and used by
 * OverdueTicker + useDashboardData. One escalated (is_escalated = true) ticket.
 * Canonical home is here; the route re-exports it for backwards compat.
 */
export interface OverdueTicketItem {
  id: string;
  subject: string;
  agentName: string;
}

/**
 * The two queendom identifiers used throughout the app.
 * Previously a locally-typed literal union in ActiveOutlays, QueendomPanel, etc.
 */
export type QueendomId = "ananyshree" | "anishqa";

/**
 * The screens DashboardController rotates between.
 * Previously defined inline in DashboardController.tsx only.
 */
export type ActiveScreen = "concierge" | "onboarding" | "home";

/**
 * Data returned by GET /api/renewals-panel.
 * Previously duplicated as a local interface in Dashboard, DashboardController,
 * QueendomPanel, and RenewalsPanel — four identical copies.
 */
export interface RenewalsPanelData {
  totalRenewalsThisMonth: number;
  renewals: string[];
  assignments: string[];
}

/**
 * Shape of the GET /api/clients response.
 * Previously defined inline in Dashboard.tsx only.
 */
export interface MemberApiResponse {
  ananyshree: MemberStats;
  anishqa: MemberStats;
}

/**
 * Shape of the GET /api/clients/expiring response — renewals due this IST
 * month per queendom, ranked by `endDate` ascending (UpcomingRenewals card).
 */
export interface RenewalsDueResponse {
  ananyshree: RenewalDueClient[];
  anishqa: RenewalDueClient[];
}

/**
 * A single finance outlay row in ActiveOutlays display state.
 * Previously defined inline in ActiveOutlays.tsx only.
 * `pending: false` means the row has been paid and is awaiting its exit animation.
 */
export interface DisplayOutlay {
  id: string;
  client_name: string;
  task: string;
  amount: number;
  /** false = marked "paid" — show emerald success color, then remove after PAID_EXIT_MS. */
  pending: boolean;
}
