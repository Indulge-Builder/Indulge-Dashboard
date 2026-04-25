-- Rename onboarding_deals to deals for a shared ledger namespace.
-- Keeps existing data and realtime/RLS behavior intact.

DO $$
BEGIN
  -- Case 1: onboarding_deals exists and deals does not -> rename in place.
  IF to_regclass('public.onboarding_deals') IS NOT NULL
     AND to_regclass('public.deals') IS NULL THEN
    ALTER TABLE public.onboarding_deals RENAME TO deals;
  END IF;

  -- Case 2: both tables exist -> backfill missing rows into deals.
  IF to_regclass('public.onboarding_deals') IS NOT NULL
     AND to_regclass('public.deals') IS NOT NULL THEN
    INSERT INTO public.deals (deal_id, deal_name, agent_name, created_at)
    SELECT od.deal_id, od.deal_name, od.agent_name, od.created_at
    FROM public.onboarding_deals od
    ON CONFLICT (deal_id) DO NOTHING;
  END IF;

  -- Case 3: neither table exists (fresh DB) -> create deals.
  IF to_regclass('public.deals') IS NULL THEN
    CREATE TABLE public.deals (
      deal_id text PRIMARY KEY,
      deal_name text NOT NULL,
      agent_name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS deals_created_at_idx
  ON public.deals (created_at DESC);

CREATE INDEX IF NOT EXISTS deals_agent_created_idx
  ON public.deals (agent_name, created_at DESC);

COMMENT ON TABLE public.deals IS
  'Zoho CRM deal-creation events. Webhook: POST /api/webhooks/zoho-deals';

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "onboarding_deals_select_anon" ON public.deals;
DROP POLICY IF EXISTS "deals_select_anon" ON public.deals;
CREATE POLICY "deals_select_anon"
  ON public.deals FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "onboarding_deals_all_authenticated" ON public.deals;
DROP POLICY IF EXISTS "deals_all_authenticated" ON public.deals;
CREATE POLICY "deals_all_authenticated"
  ON public.deals FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'onboarding_deals'
    ) THEN
      ALTER PUBLICATION supabase_realtime DROP TABLE public.onboarding_deals;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'deals'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;
    END IF;
  END IF;
END $$;

-- After successful rename/backfill, drop old table if it still exists.
DROP TABLE IF EXISTS public.onboarding_deals;
