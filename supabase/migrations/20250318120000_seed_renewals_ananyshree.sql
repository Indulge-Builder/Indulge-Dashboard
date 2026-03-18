-- Seed renewals and assignments for ananyshree queendom.
-- Schema: renewals/members expect client_name, group (or queendom), created_at

-- Ensure renewals table exists
CREATE TABLE IF NOT EXISTS public.renewals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT,
  "group" TEXT,
  queendom TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure members table exists
CREATE TABLE IF NOT EXISTS public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT,
  "group" TEXT,
  queendom TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Realtime for renewals panel
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'renewals') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.renewals;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'members') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.members;
    END IF;
  END IF;
END $$;

-- ─── RLS Policies (aligned with jokers, tickets, clients) ─────────────────────
ALTER TABLE public.renewals ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read for dashboard display and Realtime subscriptions
CREATE POLICY "renewals_select_anon"
  ON public.renewals FOR SELECT
  TO anon
  USING (true);

-- Allow authenticated users full access (for sync services, admin tools)
CREATE POLICY "renewals_all_authenticated"
  ON public.renewals FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_anon"
  ON public.members FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "members_all_authenticated"
  ON public.members FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Service role bypasses RLS by default (API routes use service role)

-- Seed ananyshree renewals (Latest Renewals section)
INSERT INTO public.renewals (client_name, "group", queendom) VALUES
  ('Srinivas Kalyan', 'ananyshree', 'ananyshree'),
  ('Rohit Reddy', 'ananyshree', 'ananyshree'),
  ('Eashan', 'ananyshree', 'ananyshree'),
  ('Pankil Yadav', 'ananyshree', 'ananyshree')

