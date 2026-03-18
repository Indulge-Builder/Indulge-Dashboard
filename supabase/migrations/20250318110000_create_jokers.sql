-- Jokers table for specialized Joker metrics (Google Sheet sync).
-- Columns: client_name, city, date, type, suggestion, response, queendom_name, joker_name

CREATE TABLE IF NOT EXISTS public.jokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT,
  city TEXT,
  date DATE,
  type TEXT,
  suggestion TEXT,
  response TEXT,
  queendom_name TEXT,
  joker_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Realtime for instant TV dashboard updates when Sheet syncs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'jokers'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jokers;
  END IF;
END $$;

-- ─── RLS Policies (aligned with tickets, clients, renewals) ───────────────────
ALTER TABLE public.jokers ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read for dashboard display and Realtime subscriptions
CREATE POLICY "jokers_select_anon"
  ON public.jokers FOR SELECT
  TO anon
  USING (true);

-- Allow authenticated users full access (for sync services, admin tools)
CREATE POLICY "jokers_all_authenticated"
  ON public.jokers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Service role bypasses RLS by default (API routes use service role)
