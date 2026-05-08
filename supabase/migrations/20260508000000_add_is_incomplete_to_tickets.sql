-- Add is_incomplete column to tickets for agent leaderboard display.
-- Referenced in AgentRow.tsx (pending column) and TicketRowMinimal type.
-- DEFAULT false so all existing rows are treated as complete (not flagged).

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS is_incomplete BOOLEAN NOT NULL DEFAULT false;
