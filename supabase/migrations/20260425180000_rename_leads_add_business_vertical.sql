-- Migration: rename onboarding_lead_touches → leads + add business_vertical
--
-- Changes:
--   1. Rename table onboarding_lead_touches → leads
--   2. Rename all associated indexes
--   3. Add business_vertical column (4 Indulge verticals)
--   4. Add index for vertical trendline query
--   5. Update RLS policies for the renamed table
--   6. Update supabase_realtime publication
--
-- NOTE: In Postgres, RLS policies and check constraints are table-bound and
--       follow the table rename automatically. We drop-and-recreate them here
--       only to keep names consistent and readable.

-- ── 1. Rename table ────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.onboarding_lead_touches
  RENAME TO leads;

-- ── 2. Rename existing indexes ────────────────────────────────────────────────
ALTER INDEX IF EXISTS public.onboarding_lead_touches_agent_created_idx
  RENAME TO leads_agent_created_idx;

ALTER INDEX IF EXISTS public.onboarding_lead_touches_created_at_idx
  RENAME TO leads_created_at_idx;

ALTER INDEX IF EXISTS public.onboarding_lead_touches_modified_at_idx
  RENAME TO leads_modified_at_idx;

-- ── 3. Add business_vertical column ──────────────────────────────────────────
-- Nullable initially so existing rows don't violate the constraint.
-- Default set to 'Indulge Global' (highest-volume vertical, matches legacy
-- concierge onboarding flow which was the sole use-case before multi-vertical).
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS business_vertical TEXT
    DEFAULT 'Indulge Global'
    CHECK (
      business_vertical IN (
        'Indulge Global',
        'Indulge Shop',
        'Indulge House',
        'Indulge Legacy'
      )
    );

-- Back-fill any NULL rows that sneak in before NOT NULL is enforced
UPDATE public.leads
  SET business_vertical = 'Indulge Global'
  WHERE business_vertical IS NULL;

ALTER TABLE public.leads
  ALTER COLUMN business_vertical SET NOT NULL,
  ALTER COLUMN business_vertical SET DEFAULT 'Indulge Global';

COMMENT ON COLUMN public.leads.business_vertical IS
  'Which Indulge revenue vertical this lead belongs to. '
  'Set by Zoho webhook payload field "business_vertical". '
  'Valid values: Indulge Global | Indulge Shop | Indulge House | Indulge Legacy';

-- ── 4. Index for 7-day vertical trendline query ───────────────────────────────
CREATE INDEX IF NOT EXISTS leads_vertical_created_idx
  ON public.leads (business_vertical, created_at DESC);

-- ── 5. Update RLS policies ────────────────────────────────────────────────────
-- The old policies were carried over by Postgres on rename, but their names
-- still reference "onboarding_lead_touches". Drop & recreate with clean names.

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "onboarding_lead_touches_select_anon" ON public.leads;
DROP POLICY IF EXISTS "onboarding_lead_touches_all_authenticated" ON public.leads;
DROP POLICY IF EXISTS "leads_select_anon" ON public.leads;
DROP POLICY IF EXISTS "leads_all_authenticated" ON public.leads;

CREATE POLICY "leads_select_anon"
  ON public.leads FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "leads_all_authenticated"
  ON public.leads FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── 6. Update realtime publication ───────────────────────────────────────────
-- Remove old table name (if still tracked) and add the new one.
DO $$
BEGIN
  -- Remove onboarding_lead_touches if still in the publication (pre-rename ghost)
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'onboarding_lead_touches'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.onboarding_lead_touches;
  END IF;

  -- Add leads to publication
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'leads'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
  END IF;
END $$;

COMMENT ON TABLE public.leads IS
  'One row per Zoho lead_id; upserted on CRM create/update via zoho-leads webhook. '
  'business_vertical routes each lead to the correct Indulge revenue stream.';
