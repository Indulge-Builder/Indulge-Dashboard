-- Add is_escalated column for SLA escalation (overdue) tracking.
-- Default false so existing rows are not escalated.
-- The tickets table is already in supabase_realtime publication, so new columns
-- are automatically included in replication — no ALTER PUBLICATION needed.

ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS is_escalated BOOLEAN NOT NULL DEFAULT false;
