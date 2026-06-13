-- Add subject column to tickets for the Overdue Ticker display.
-- The ticker shows escalated (is_escalated = true) tickets as
-- [SUBJECT] | [TICKET ID] | [AGENT]. Populated by the Freshdesk upsert webhook
-- via {{ticket.subject}}; existing rows fall back to the ticket id in the UI.
-- Nullable (no default) so historical rows stay NULL until their next update.
-- The tickets table is already in supabase_realtime, so the new column is
-- automatically included in replication — no ALTER PUBLICATION needed.

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS subject TEXT;
