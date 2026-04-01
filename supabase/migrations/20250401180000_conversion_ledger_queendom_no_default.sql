-- Stop defaulting new rows to Ananyshree; empty queendom stays blank in the UI.
ALTER TABLE public.onboarding_conversion_ledger
  ALTER COLUMN queendom_name SET DEFAULT '';
