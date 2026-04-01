-- Live concierge expenses / reimbursements for Finances TV widget.
-- Columns: client_name, task, amount, status (pending | paid), queendom_name

CREATE TABLE IF NOT EXISTS public.finance_outlays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT,
  task TEXT,
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  queendom_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS finance_outlays_queendom_status_idx
  ON public.finance_outlays (queendom_name, status);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'finance_outlays'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_outlays;
  END IF;
END $$;

ALTER TABLE public.finance_outlays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance_outlays_select_anon"
  ON public.finance_outlays FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "finance_outlays_all_authenticated"
  ON public.finance_outlays FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
