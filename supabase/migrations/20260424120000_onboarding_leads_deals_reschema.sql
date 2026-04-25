-- Reshape onboarding_lead_touches: Zoho sends on lead create/update.
-- Replace first_touched_at / updated_at with created_at / modified_at.
-- Drop hot-lead columns (intent, company).
-- Add onboarding_deals for Zoho deal-creation events.

-- ── Lead touches: new timestamps ─────────────────────────────────────────────
ALTER TABLE public.onboarding_lead_touches
  ADD COLUMN IF NOT EXISTS created_at timestamptz,
  ADD COLUMN IF NOT EXISTS modified_at timestamptz;

UPDATE public.onboarding_lead_touches
SET
  created_at = COALESCE(created_at, first_touched_at),
  modified_at = COALESCE(modified_at, updated_at, first_touched_at)
WHERE created_at IS NULL OR modified_at IS NULL;

UPDATE public.onboarding_lead_touches
SET created_at = now()
WHERE created_at IS NULL;

UPDATE public.onboarding_lead_touches
SET modified_at = created_at
WHERE modified_at IS NULL;

ALTER TABLE public.onboarding_lead_touches
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN modified_at SET NOT NULL;

ALTER TABLE public.onboarding_lead_touches
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN modified_at SET DEFAULT now();

DROP INDEX IF EXISTS public.onboarding_lead_touches_intent_recency_idx;
DROP INDEX IF EXISTS public.onboarding_lead_touches_today_idx;
DROP INDEX IF EXISTS public.onboarding_lead_touches_agent_first_touched_idx;

ALTER TABLE public.onboarding_lead_touches
  DROP COLUMN IF EXISTS intent,
  DROP COLUMN IF EXISTS company,
  DROP COLUMN IF EXISTS first_touched_at,
  DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.onboarding_lead_touches
  ADD COLUMN IF NOT EXISTS lead_name text;

UPDATE public.onboarding_lead_touches SET lead_name = '' WHERE lead_name IS NULL;

ALTER TABLE public.onboarding_lead_touches
  ALTER COLUMN lead_name SET NOT NULL,
  ALTER COLUMN lead_name SET DEFAULT '';

COMMENT ON COLUMN public.onboarding_lead_touches.created_at IS
  'When this lead row was first received from Zoho (lead created in CRM).';
COMMENT ON COLUMN public.onboarding_lead_touches.modified_at IS
  'Last update from Zoho for this lead row.';

CREATE INDEX IF NOT EXISTS onboarding_lead_touches_agent_created_idx
  ON public.onboarding_lead_touches (agent_name, created_at);

CREATE INDEX IF NOT EXISTS onboarding_lead_touches_created_at_idx
  ON public.onboarding_lead_touches (created_at DESC);

CREATE INDEX IF NOT EXISTS onboarding_lead_touches_modified_at_idx
  ON public.onboarding_lead_touches (modified_at DESC);

COMMENT ON TABLE public.onboarding_lead_touches IS
  'One row per Zoho lead_id; upserted on CRM create/update.';

-- ── Deal creations (Zoho “new deal”) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.onboarding_deals (
  deal_id text PRIMARY KEY,
  deal_name text NOT NULL,
  agent_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_deals_created_at_idx
  ON public.onboarding_deals (created_at DESC);

CREATE INDEX IF NOT EXISTS onboarding_deals_agent_created_idx
  ON public.onboarding_deals (agent_name, created_at DESC);

COMMENT ON TABLE public.onboarding_deals IS
  'Zoho CRM deal-creation events. Webhook: POST /api/webhooks/zoho-deals';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'onboarding_deals'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.onboarding_deals;
  END IF;
END $$;

ALTER TABLE public.onboarding_deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "onboarding_deals_select_anon" ON public.onboarding_deals;
CREATE POLICY "onboarding_deals_select_anon"
  ON public.onboarding_deals FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "onboarding_deals_all_authenticated" ON public.onboarding_deals;
CREATE POLICY "onboarding_deals_all_authenticated"
  ON public.onboarding_deals FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
