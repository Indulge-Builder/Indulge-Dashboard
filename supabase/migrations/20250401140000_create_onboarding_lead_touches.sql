-- Unique lead touches for Zoho CRM → dashboard "Attempted This Month" (per agent).
-- Webhook: POST /api/webhooks/zoho-leads

CREATE TABLE IF NOT EXISTS public.onboarding_lead_touches (
  lead_id text PRIMARY KEY,
  agent_name text NOT NULL,
  latest_status text NOT NULL,
  first_touched_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_lead_touches_agent_first_touched_idx
  ON public.onboarding_lead_touches (agent_name, first_touched_at);

COMMENT ON TABLE public.onboarding_lead_touches IS
  'One row per Zoho lead; first_touched_at preserved on status updates.';
