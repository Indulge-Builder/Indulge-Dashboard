export interface MemberStats {
  total: number;
  yearly: number;
  monthly: number;
}

export interface TicketStats {
  totalThisMonth: number; // all tickets where created_at is within this calendar month
  solvedThisMonth: number; // Resolved | Closed  AND  resolved_at within this month
  solvedToday: number; // Resolved | Closed  AND  resolved_at within today
  pendingToResolve: number; // any active / open status — no date gate
}

export interface QueenStats {
  members: MemberStats;
  tickets: TicketStats;
}

export type PlanTier = "diamond" | "platinum" | "gold" | "silver";

export interface Onboarding {
  id: string;
  clientName: string;
  plan: string;
  planTier: PlanTier;
  salesperson: string;
  createdAt: string;
}
