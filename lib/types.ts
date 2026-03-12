export interface MemberStats {
  total: number;
}

export interface TicketStats {
  resolvedThisMonth: number; // tickets with resolved_at within this calendar month (resolved or closed)
  solvedToday: number;       // Resolved | Closed  AND  resolved_at within today
  pendingToResolve: number;  // any active / open status — no date gate
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

