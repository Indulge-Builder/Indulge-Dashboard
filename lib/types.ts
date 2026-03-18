export interface MemberStats {
  total: number;
}

export interface TicketStats {
  totalReceived: number; // count of ALL rows in tickets where queendom_name matches
  totalThisMonth?: number; // deprecated: use totalReceived
  resolvedThisMonth: number; // tickets with resolved_at within this calendar month (resolved or closed)
  solvedToday: number; // Resolved | Closed  AND  resolved_at within today
  pendingToResolve: number; // any active / open status — no date gate
  jokerSuggestion: number; // tickets with tags.joker_suggestion set (legacy)
}

/** Joker-specific metrics from the jokers table */
export interface JokerStats {
  totalSuggestions: number;
  acceptedCount: number;
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
  pendingScore: number;
  overdueCount: number;
  escalatedCount: number;
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
