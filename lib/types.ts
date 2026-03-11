export interface MemberStats {
  total: number;
}

export interface TicketStats {
  totalThisMonth: number;    // all tickets created within this calendar month
  receivedToday: number;     // all tickets created today (any status)
  resolvedThisMonth: number; // resolved/closed tickets where resolved_at is this month
  solvedToday: number;       // resolved/closed tickets where resolved_at is today
  pendingToResolve: number;  // active-status tickets created this month
  overdueCount: number;      // active-status tickets created BEFORE today (backlog)
}

export interface AgentStats {
  id: string;
  name: string;
  queendom: "ananyshree" | "anishqa";
  tasksAssignedToday: number;
  tasksCompletedToday: number;
  tasksCompletedThisMonth: number;
  overdueCount: number;      // active tickets assigned to this agent created before today
}

export interface QueenStats {
  members: MemberStats;
  tickets: TicketStats;
  agents: AgentStats[];
}

