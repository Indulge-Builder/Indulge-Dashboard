-- Zoho CRM deals webhook deduplication (POST /api/webhooks/zoho-deals)

ALTER TABLE public.onboarding_conversion_ledger
  ADD COLUMN IF NOT EXISTS deal_id text;

COMMENT ON COLUMN public.onboarding_conversion_ledger.deal_id IS
  'Zoho CRM deal id; unique when set so repeat webhooks do not double-count closures.';

CREATE UNIQUE INDEX IF NOT EXISTS onboarding_conversion_ledger_deal_id_key
  ON public.onboarding_conversion_ledger (deal_id)
  WHERE deal_id IS NOT NULL;
