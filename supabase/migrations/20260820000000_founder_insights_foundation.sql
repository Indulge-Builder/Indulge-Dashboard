-- Founder insights foundation (2026-08-20)
-- 1. Widen tickets with the Freshdesk fields we previously discarded
-- 2. ticket_events: append-only state transitions (webhook + reconcile + backfill)
-- 3. csat_ratings: satisfaction survey sync
-- TV reads only the original 10 columns — untouched by construction.

alter table public.tickets
  add column if not exists priority           smallint,
  add column if not exists source             text,
  add column if not exists ticket_type        text,
  add column if not exists requester_id       bigint,
  add column if not exists company_id         bigint,
  add column if not exists first_responded_at timestamptz,
  add column if not exists agent_responded_at timestamptz,
  add column if not exists reopened_at        timestamptz,
  add column if not exists pending_since      timestamptz,
  add column if not exists closed_at          timestamptz,
  add column if not exists due_by             timestamptz,
  add column if not exists fr_due_by          timestamptz,
  add column if not exists fr_escalated       boolean,
  add column if not exists is_billable        boolean,
  add column if not exists invoice_amount     numeric,
  add column if not exists fd_updated_at      timestamptz;

create index if not exists tickets_requester_idx on public.tickets (requester_id);
create index if not exists tickets_created_idx   on public.tickets (created_at);
create index if not exists tickets_type_idx      on public.tickets (ticket_type);

create table if not exists public.ticket_events (
  id            bigint generated always as identity primary key,
  ticket_id     text not null,
  event_type    text not null,   -- created | status_change | escalated | de_escalated | reopened | assigned
  from_value    text,
  to_value      text,
  agent_name    text,
  queendom_name text,
  occurred_at   timestamptz not null default now(),
  source        text not null default 'webhook'  -- webhook | reconcile | backfill
);
create index if not exists ticket_events_ticket_idx on public.ticket_events (ticket_id, occurred_at);
create index if not exists ticket_events_time_idx   on public.ticket_events (occurred_at);

create table if not exists public.csat_ratings (
  id            bigint primary key,      -- Freshdesk rating id
  ticket_id     text not null,
  agent_name    text,
  queendom_name text,
  rating        integer not null,        -- raw Freshdesk value (e.g. 103..-103)
  rating_label  text,
  feedback      text,
  created_at    timestamptz not null
);
create index if not exists csat_created_idx on public.csat_ratings (created_at);

-- Standard RLS pattern (anon SELECT, authenticated ALL; service role bypasses)
alter table public.ticket_events enable row level security;
alter table public.csat_ratings  enable row level security;
drop policy if exists ticket_events_anon_select on public.ticket_events;
create policy ticket_events_anon_select on public.ticket_events for select to anon using (true);
drop policy if exists ticket_events_auth_all on public.ticket_events;
create policy ticket_events_auth_all on public.ticket_events for all to authenticated using (true) with check (true);
drop policy if exists csat_anon_select on public.csat_ratings;
create policy csat_anon_select on public.csat_ratings for select to anon using (true);
drop policy if exists csat_auth_all on public.csat_ratings;
create policy csat_auth_all on public.csat_ratings for all to authenticated using (true) with check (true);
