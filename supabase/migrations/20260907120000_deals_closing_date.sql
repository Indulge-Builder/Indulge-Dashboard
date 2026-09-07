-- deals.closing_date — the business date a closure counts on.
--
-- Zoho `Deals.Closing_Date` is the date the sale actually closed; deals are
-- often entered into Zoho days later (7 September closures were all created in
-- Zoho on 2026-09-07 16:07–16:13 IST with Closing_Date 1–6 Sept). Counting
-- closures by `created_at` therefore under-reports the month and dates every
-- ledger row on the entry day. The API now counts / lists closures by this
-- column and falls back to `created_at` (IST day) while it is NULL or absent.
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS closing_date date;

COMMENT ON COLUMN public.deals.closing_date IS
  'Zoho Deals.Closing_Date — the IST calendar day the closure counts on. NULL → API falls back to created_at. Added 2026-09-07.';

-- Seed from created_at so history keeps its month until the Zoho reconcile
-- (`npm run reconcile-zoho`) overwrites it with the real Closing_Date.
UPDATE public.deals
   SET closing_date = (created_at AT TIME ZONE 'Asia/Kolkata')::date
 WHERE closing_date IS NULL;

CREATE INDEX IF NOT EXISTS deals_closing_date_idx
  ON public.deals (closing_date DESC);
