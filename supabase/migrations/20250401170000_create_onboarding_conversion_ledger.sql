-- Live Conversion Ledger (Onboarding TV) — closure rows for scrolling strip.
-- Columns: client name, amount (INR), agent, queendom, closure date.

CREATE TABLE IF NOT EXISTS public.onboarding_conversion_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  amount numeric(14, 2) NOT NULL,
  agent_name text NOT NULL,
  queendom_name text NOT NULL DEFAULT '',
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_conversion_ledger_recorded_at_idx
  ON public.onboarding_conversion_ledger (recorded_at DESC);

COMMENT ON TABLE public.onboarding_conversion_ledger IS
  'Sales closures for Onboarding panel Live Conversion Ledger; amounts in INR.';

COMMENT ON COLUMN public.onboarding_conversion_ledger.client_name IS 'Client / lead display name';
COMMENT ON COLUMN public.onboarding_conversion_ledger.recorded_at IS 'Closure date (shown in UI)';

-- Realtime for live inserts on the TV
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'onboarding_conversion_ledger'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.onboarding_conversion_ledger;
  END IF;
END $$;

ALTER TABLE public.onboarding_conversion_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onboarding_conversion_ledger_select_anon"
  ON public.onboarding_conversion_ledger FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "onboarding_conversion_ledger_all_authenticated"
  ON public.onboarding_conversion_ledger FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
