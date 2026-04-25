-- Migration: add intent, lead_name, and company to onboarding_lead_touches
-- Required for the Hot Leads Radar (LivePriorityQueue) introduced in Step 4.
--
-- Run this migration in Supabase before deploying the updated zoho-leads
-- webhook, otherwise the webhook will fall back to the base insert (no intent
-- data captured) until this migration is applied.
--
-- SAFE TO RUN MULTIPLE TIMES (all statements use IF NOT EXISTS / IF NOT EXISTS).

ALTER TABLE public.onboarding_lead_touches
  ADD COLUMN IF NOT EXISTS intent    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lead_name TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS company   TEXT DEFAULT NULL;

COMMENT ON COLUMN public.onboarding_lead_touches.intent IS
  'Zoho Lead intent dropdown value (e.g. "High", "Very High", "Hot"). '
  'Populated by the zoho-leads webhook from the Zoho automation merge field. '
  'NULL until migration is applied and Zoho is configured to send this field.';

COMMENT ON COLUMN public.onboarding_lead_touches.lead_name IS
  'Zoho Lead name (first_name or full display name from Zoho payload). '
  'Shown in the Hot Leads Radar card as a human-readable identifier.';

COMMENT ON COLUMN public.onboarding_lead_touches.company IS
  'Zoho Lead company / account name. Optional display context.';

-- Index for Hot Leads Radar query: filter by intent + sort by recency
CREATE INDEX IF NOT EXISTS onboarding_lead_touches_intent_recency_idx
  ON public.onboarding_lead_touches (intent, first_touched_at DESC)
  WHERE intent IS NOT NULL;

-- Index for today's touches query (fallback when intent is null)
CREATE INDEX IF NOT EXISTS onboarding_lead_touches_today_idx
  ON public.onboarding_lead_touches (first_touched_at DESC);
