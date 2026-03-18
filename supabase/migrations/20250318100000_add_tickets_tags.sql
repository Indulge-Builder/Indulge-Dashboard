-- Add tags JSONB column for custom metadata (e.g. joker_suggestion).
-- Used by the Joker metric to count tickets with tags.joker_suggestion set.

ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '{}'::jsonb;
