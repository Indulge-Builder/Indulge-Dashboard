export interface MemberStats {
  total: number;
}

export interface TicketStats {
  totalThisMonth: number; // all tickets where created_at is within this calendar month
  solvedThisMonth: number; // Resolved | Closed  AND  resolved_at within this month
  solvedToday: number; // Resolved | Closed  AND  resolved_at within today
  pendingToResolve: number; // any active / open status — no date gate
}

export interface AgentStats {
  id: string;
  name: string;
  queendom: "ananyshree" | "anishqa";
  tasksAssignedToday: number;
  tasksCompletedToday: number;
  tasksCompletedThisMonth: number;
}

export interface QueenStats {
  members: MemberStats;
  tickets: TicketStats;
  agents: AgentStats[];
}

export interface Onboarding {
  id: string;
  clientName: string;
  plan: string;

  salesperson: string;
  createdAt: string;
}
