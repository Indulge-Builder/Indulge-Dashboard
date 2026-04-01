/** Shared shapes for onboarding sales TV + GET /api/onboarding */

export interface OnboardingAgentRow {
  id: string;
  name: string;
  photoUrl: string | null;
  totalAttempted: number;
  /** Closures in rolling last 30 days (conversion ledger by agent_name) */
  totalConverted: number;
  /** Leads first touched today (IST), from onboarding_lead_touches */
  leadsAttendToday: number;
}

export interface OnboardingLedgerRow {
  id: string;
  clientName: string;
  amount: number;
  recordedAt: string; // ISO
  /** Queendom name (e.g. Ananyshree, Anishqa) */
  assignedTo: string;
  agentName: string;
}

export interface OnboardingApiPayload {
  agents: OnboardingAgentRow[];
  ledger: OnboardingLedgerRow[];
}
