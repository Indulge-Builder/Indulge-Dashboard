/** Shared shapes for onboarding sales TV + GET /api/onboarding */

export interface OnboardingAgentRow {
  id: string;
  name: string;
  photoUrl: string | null;
  totalAttempted: number;
  totalConverted: number;
}

export interface OnboardingLedgerRow {
  id: string;
  clientName: string;
  amount: number;
  recordedAt: string; // ISO
  agentName: string;
}

export interface OnboardingApiPayload {
  agents: OnboardingAgentRow[];
  ledger: OnboardingLedgerRow[];
}
