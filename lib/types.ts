export interface MemberStats {
  /** Active clients whose membership is Premium, Genie, Monthly Trial, or Standard (paid pill). */
  total: number;
  /** Active Celebrity-tier clients in this Queendom (complimentary / unpaid pill). */
  celebrityActive: number;
  /** Clients whose latest_subscription_status is Expired (To Be Revived pill). */
  toBeRevived: number;
}

export interface TicketStats {
  totalReceived: number; // tickets created in the current IST calendar month (label: Received This Month)
  resolvedThisMonth: number; // cohort math: created this IST month AND status is terminal (resolved/closed)
  solvedToday: number; // cohort math: created today (IST) AND status is terminal
  pendingToResolve: number; // created this IST month AND status NOT terminal (month-gated, matches the hero row's "This Month" title; label: Pending)
  jokerSuggestion: number; // tickets created this IST month with tags.joker_suggestion set (legacy)
}

/** Joker-specific metrics from the `jokers` table (current IST calendar month; see GET /api/jokers). */
export interface JokerStats {
  /** Distinct suggestion text (lowercase + trim) — this month’s idea count. */
  uniqueSuggestionsCount: number;
  /** Total rows this month (same as `totalSuggestions`). */
  totalSent: number;
  /** Total rows — alias of `totalSent`. */
  totalSuggestions: number;
  /** "yes" responses this month. */
  acceptedCount: number;
  /** Rows where response is explicitly "no" (paired with acceptedCount for acceptance rate). */
  rejectedCount: number;
  pendingSuggestions: number;
  acceptedToday: number;
  /** Same as totalSent for this month’s cohort. */
  totalThisMonth: number;
}

export interface AgentStats {
  id: string;
  name: string;
  queendom: "ananyshree" | "anishqa";
  tasksAssignedToday: number;
  tasksCompletedToday: number;
  tasksCompletedThisMonth: number;
  tasksAssignedThisMonth: number;
  /** Open tickets created this IST month (month-gated — agents' sum matches Queendom pending). */
  pendingScore: number;
  /** Open AND `is_escalated`, ANY month — carries forward until cleared (D2 revised 2026-07-02). May exceed pendingScore. */
  overdueCount: number;
  /** `is_incomplete` and status ∈ nudge client / nudge vendor / ongoing delivery / invoice due — ANY month, carries forward. */
  incomplete: number;
}

/**
 * A client whose `latest_subscription_end` falls in the current IST month —
 * a renewal the Queendom is supposed to land (GET /api/clients/expiring).
 */
export interface RenewalDueClient {
  name: string;
  /** `latest_subscription_end` as YYYY-MM-DD (IST calendar date). */
  endDate: string;
  membershipType: string | null;
}

export interface QueenStats {
  members: MemberStats;
  tickets: TicketStats;
  agents: AgentStats[];
  joker?: JokerStats;
  /** Daily + hourly ticket timelines for the Pulse / Heartbeat graphs. */
  series?: import("./ticketTimeSeries").TicketTimeSeries;
  /**
   * UTC ms of this Queendom's most recent ticket resolution — monotonic max
   * maintained by useDashboardData (survives row pruning). Drives the
   * ResolveStopwatch. null until the first resolution is seen.
   */
  lastResolvedAtMs?: number | null;
  /** Renewals due this IST month, ranked by endDate ascending. */
  renewalsDue?: RenewalDueClient[];
}

export interface SpecialDate {
  id: string;
  clientName: string;
  date: string; // YYYY-MM-DD
  type: "birthday" | "anniversary";
  queendom: "ananyshree" | "anishqa";
  /** Expired membership — muted styling on the Special Dates card */
  isExpired?: boolean;
}
