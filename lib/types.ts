export interface MemberStats {
  /** Active clients whose membership is Premium, Genie, Monthly Trial, or Standard (paid pill). */
  total: number;
  /** Active Celebrity-tier clients in this Queendom (complimentary / unpaid pill). */
  celebrityActive: number;
}

export interface TicketStats {
  totalReceived: number; // tickets created in the current IST calendar month (label: Received This Month)
  totalThisMonth?: number; // deprecated: use totalReceived
  resolvedThisMonth: number; // created this IST month + status resolved only (closed not scored)
  solvedToday: number; // status "resolved" AND created_at is today (IST)
  pendingToResolve: number; // created this IST month; status neither resolved nor closed
  jokerSuggestion: number; // tickets with tags.joker_suggestion set (legacy)
}

/** Joker-specific metrics from the jokers table */
export interface JokerStats {
  /** Distinct suggestion text (lowercase + trim) — idea count without duplicate-blast inflation. */
  uniqueSuggestionsCount: number;
  /** Total rows / reach (same as `totalSuggestions`). */
  totalSent: number;
  /** Total rows — alias of `totalSent`. */
  totalSuggestions: number;
  acceptedCount: number;
  /** Rows where response is explicitly "no" (paired with acceptedCount for acceptance rate). */
  rejectedCount: number;
  pendingSuggestions: number;
  acceptedToday: number;
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
  /** Open tickets created this IST month (same cohort as Queendom pending). */
  pendingScore: number;
  /** Among that monthly pending set: `is_escalated` (shown as Overdue in the leaderboard). */
  overdueCount: number;
}

export interface QueenStats {
  members: MemberStats;
  tickets: TicketStats;
  agents: AgentStats[];
  joker?: JokerStats;
}

export interface JokerRecommendation {
  id: string;
  category: string;
  text: string;
  place: string; // city or location name
  icon: "restaurant" | "travel" | "hotel" | "spa" | "experience";
}

export interface SpecialDate {
  id: string;
  clientName: string;
  date: string; // YYYY-MM-DD
  type: "birthday" | "anniversary";
  queendom: "ananyshree" | "anishqa";
}
