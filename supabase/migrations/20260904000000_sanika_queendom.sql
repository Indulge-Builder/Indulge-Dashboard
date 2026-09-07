-- ─────────────────────────────────────────────────────────────────────────────
-- Third Queendom: Sanika (2026-09-04)
--
-- Freshdesk group "Sanika's Queendom" (id 1070000391947) went live on
-- 2026-09-01; `clients.group` / `members.group` already carry
-- "Sanika Queendom" from the external sync. This migration is everything the
-- DATABASE needs so the app's queendom registry (lib/queendom.ts) can include
-- her:
--
--   1. `agents.queendom` CHECK gains 'sanika'.
--   2. The renewals / members label normaliser learns the third canonical
--      label ("Sanika Queendom").
--   3. `live_queendom_id(text)` — ONE Postgres definition of "which live
--      queendom is this group name" (mirrors normalizeQueendom()). Every
--      founder-analytics function below is re-created on top of it instead
--      of repeating `ilike '%ananyshree%' or ilike '%anishqa%'` inline, so a
--      fourth queendom is a one-line change here.
--   4. Seed Sanika's roster: the names filing under her group in its first
--      month (Kshathriya C C A · Shanaya Javeri · Depender Kaur). Sanika
--      Ahire's own row moves from ananyshree to sanika and stays hidden,
--      matching the other queens (Ananyshree Munshi / Anishqa Bhagia are not
--      ranked on their own leaderboards). No Joker is known for her yet —
--      the Spoiled tile reads 0 until one is set in /settings.
--
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═══ 1. agents.queendom CHECK ═══════════════════════════════════════════════

ALTER TABLE public.agents DROP CONSTRAINT IF EXISTS agents_queendom_check;
ALTER TABLE public.agents
  ADD CONSTRAINT agents_queendom_check
  CHECK (queendom IN ('ananyshree', 'anishqa', 'sanika'));


-- ═══ 2. renewals / members label normaliser ═════════════════════════════════
-- Same function the 2026-08-11 migration installed; only the third branch is
-- new. Existing triggers on renewals / members keep pointing at it.

CREATE OR REPLACE FUNCTION public.normalise_queendom_label()
RETURNS TRIGGER AS $$
DECLARE
  raw       TEXT := lower(coalesce(NEW."group", '') || ' ' || coalesce(NEW.queendom, ''));
  canonical TEXT;
BEGIN
  IF raw LIKE '%ananyshree%' THEN
    canonical := 'Ananyshree Queendom';
  ELSIF raw LIKE '%anishqa%' THEN
    canonical := 'Anishqa Queendom';
  ELSIF raw LIKE '%sanika%' THEN
    canonical := 'Sanika Queendom';
  END IF;

  -- Unrecognised labels (e.g. 'Unassigned') pass through untouched.
  IF canonical IS NOT NULL THEN
    NEW."group"  := canonical;
    NEW.queendom := canonical;
  END IF;

  IF NEW.client_name IS NOT NULL THEN
    NEW.client_name := btrim(NEW.client_name, E' \t\r\n');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill any Sanika rows the sync wrote before this branch existed
-- (a no-op touch routes them through the trigger).
UPDATE public.renewals SET id = id
 WHERE lower(coalesce("group", '') || ' ' || coalesce(queendom, '')) LIKE '%sanika%';
UPDATE public.members SET id = id
 WHERE lower(coalesce("group", '') || ' ' || coalesce(queendom, '')) LIKE '%sanika%';


-- ═══ 3. live_queendom_id() — the SQL twin of normalizeQueendom() ════════════

CREATE OR REPLACE FUNCTION public.live_queendom_id(p_group text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE
    WHEN p_group ILIKE '%ananyshree%' THEN 'ananyshree'
    WHEN p_group ILIKE '%anishqa%'    THEN 'anishqa'
    WHEN p_group ILIKE '%sanika%'     THEN 'sanika'
  END
$$;

COMMENT ON FUNCTION public.live_queendom_id(text) IS
  'Maps a Freshdesk group / clients.group label to the app queendom id (ananyshree | anishqa | sanika) or NULL. Keep in sync with lib/queendom.ts normalizeQueendom().';


-- ── 3a. insights_pulse / insights_mix / insights_members (from 20260820000003)
--        — identical bodies, live-scope predicate swapped for live_queendom_id().

create or replace function public.insights_pulse(p_days int default 30)
returns jsonb language sql stable as $$
with tz as (select 'Asia/Kolkata'::text as z),
live as (
  select * from tickets
  where public.live_queendom_id(queendom_name) is not null
),
open_now as (
  select * from live
  where lower(status) not in ('resolved','closed','spam','deleted')
),
daily as (
  select d::date as day,
    (select count(*) from live t where (t.created_at at time zone (select z from tz))::date = d::date
       and lower(t.status) not in ('spam','deleted')) as created,
    (select count(*) from live t where (t.resolved_at at time zone (select z from tz))::date = d::date) as resolved
  from generate_series(
    (now() at time zone (select z from tz))::date - (p_days - 1),
    (now() at time zone (select z from tz))::date, '1 day') d
),
hourly as (
  select extract(hour from t.created_at at time zone (select z from tz))::int as h, count(*) as n
  from live t
  where t.created_at > now() - make_interval(days => p_days)
    and lower(t.status) not in ('spam','deleted')
  group by 1
)
select jsonb_build_object(
  'daily', (select jsonb_agg(jsonb_build_object('d', day, 'created', created, 'resolved', resolved) order by day) from daily),
  'hourly', (select jsonb_agg(coalesce(n,0) order by h.h) from generate_series(0,23) h(h) left join hourly on hourly.h = h.h),
  'aging', (select jsonb_build_object(
      'h4',  count(*) filter (where created_at > now() - interval '4 hours'),
      'h24', count(*) filter (where created_at <= now() - interval '4 hours' and created_at > now() - interval '24 hours'),
      'd3',  count(*) filter (where created_at <= now() - interval '24 hours' and created_at > now() - interval '3 days'),
      'older', count(*) filter (where created_at <= now() - interval '3 days')
    ) from open_now),
  'open_now', (select count(*) from open_now),
  'breach_risk', (select coalesce(jsonb_agg(jsonb_build_object(
      'ticket_id', ticket_id, 'subject', coalesce(subject, 'Ticket #' || ticket_id),
      'agent', agent_name, 'due_by', due_by) order by due_by), '[]'::jsonb)
    from (select * from open_now where due_by is not null and due_by < now() + interval '4 hours' order by due_by limit 8) b),
  'reopened', (select count(*) from live where reopened_at > now() - make_interval(days => p_days))
)
$$;

create or replace function public.insights_mix(p_days int default 30)
returns jsonb language sql stable as $$
with scope as (
  select * from tickets
  where created_at > now() - make_interval(days => p_days)
    and public.live_queendom_id(queendom_name) is not null
    and lower(status) not in ('spam','deleted')
)
select jsonb_build_object(
  'total', (select count(*) from scope),
  'types', (select coalesce(jsonb_agg(jsonb_build_object('k', coalesce(ticket_type,'Uncategorised'), 'n', n) order by n desc), '[]'::jsonb)
            from (select ticket_type, count(*) n from scope group by 1) t),
  'sources', (select coalesce(jsonb_agg(jsonb_build_object('k', coalesce(source,'Unknown'), 'n', n) order by n desc), '[]'::jsonb)
              from (select source, count(*) n from scope group by 1) t),
  'priorities', (select coalesce(jsonb_agg(jsonb_build_object('k', coalesce(priority::text,'0'), 'n', n) order by n desc), '[]'::jsonb)
                 from (select priority, count(*) n from scope group by 1) t),
  'billable', (select count(*) from scope where is_billable),
  'invoice_total', (select coalesce(sum(invoice_amount),0) from scope where invoice_amount is not null)
)
$$;

create or replace function public.insights_members(p_days int default 30)
returns jsonb language sql stable as $$
select coalesce(jsonb_agg(row order by (row->>'tickets')::int desc), '[]'::jsonb) from (
  select jsonb_build_object(
    'requester_id', t.requester_id,
    'client', coalesce(fc.name, fc.email, 'Contact ' || t.requester_id::text),
    'tickets', count(*),
    'open', count(*) filter (where lower(t.status) not in ('resolved','closed','spam','deleted')),
    'urgent', count(*) filter (where t.priority = 4),
    'types', (array_agg(distinct t.ticket_type) filter (where t.ticket_type is not null))[1:3]
  ) as row
  from tickets t
  left join fd_contacts fc on fc.id = t.requester_id
  where t.requester_id is not null
    and t.created_at > now() - make_interval(days => p_days)
    and public.live_queendom_id(t.queendom_name) is not null
    and lower(t.status) not in ('spam','deleted')
    -- staff pasting on WhatsApp sometimes land as the requester — never a "member"
    and not exists (select 1 from agents a where lower(trim(a.name)) = lower(trim(fc.name)))
  group by t.requester_id, fc.name, fc.email
  order by count(*) desc
  limit 12
) x
$$;

-- ── 3b. insights_scoreboard (from 20260820000005) — qid now comes from
--        live_queendom_id(), so Sanika's tickets land in her own bucket
--        instead of silently falling into the `else 'anishqa'` branch.

create or replace function public.insights_scoreboard(p_from timestamptz, p_to timestamptz)
returns jsonb language sql stable as $$
with scope as (
  select t.*,
    public.live_queendom_id(queendom_name) as qid,
    (lower(status) in ('resolved','closed')) as is_terminal,
    (lower(status) in ('resolved','closed')
      and (due_by is null or resolved_at <= due_by)) as is_ontime
  from tickets t
  where created_at >= p_from and created_at < p_to
    and public.live_queendom_id(queendom_name) is not null
    and lower(status) not in ('spam','deleted')
),
roster as (
  select trim(name) as name, queendom
  from agents where is_active and role = 'agent'
),
per_agent as (
  select r.name, r.queendom,
    count(s.ticket_id)                                  as received,
    count(*) filter (where s.is_terminal)               as resolved,
    count(*) filter (where s.is_ontime)                 as ontime,
    count(*) filter (where s.ticket_id is not null and not s.is_terminal) as pending,
    count(*) filter (where not s.is_terminal and s.is_escalated) as overdue_p,
    count(*) filter (where not s.is_terminal and not s.is_escalated
                     and coalesce(s.is_incomplete, false))       as incomplete_p,
    round((extract(epoch from avg(s.resolved_at - s.created_at)
        filter (where s.is_terminal and s.resolved_at > s.created_at)) / 3600)::numeric, 1) as avg_res_hr,
    count(*) filter (where s.reopened_at is not null)   as reopens_p
  from roster r
  left join scope s on lower(trim(s.agent_name)) = lower(r.name)
  group by r.name, r.queendom
),
overdue_now as (
  select lower(trim(agent_name)) as key, count(*) as n
  from tickets
  where is_escalated
    and lower(status) not in ('resolved','closed','spam','deleted')
  group by 1
)
select jsonb_build_object(
  'queendoms', (
    select coalesce(jsonb_object_agg(qid, stats), '{}'::jsonb) from (
      select qid, jsonb_build_object(
        'received', count(*),
        'resolved', count(*) filter (where is_terminal),
        'ontime',   count(*) filter (where is_ontime),
        'pending',  count(*) filter (where not is_terminal)
      ) as stats
      from scope group by qid
    ) q
  ),
  'agents', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', pa.name,
      'queendom', pa.queendom,
      'received', pa.received,
      'resolved', pa.resolved,
      'ontime', pa.ontime,
      'pending', pa.pending,
      'overdue_p', pa.overdue_p,
      'incomplete_p', pa.incomplete_p,
      'avg_res_hr', pa.avg_res_hr,
      'reopens_p', pa.reopens_p,
      'overdue_open', coalesce(od.n, 0)
    ) order by pa.ontime desc, pa.resolved desc, pa.name), '[]'::jsonb)
    from per_agent pa
    left join overdue_now od on od.key = lower(pa.name)
  )
)
$$;


-- ═══ 4. Seed Sanika's roster ═════════════════════════════════════════════════

-- The queen's own row: she was hidden on the Ananyshree roster; she now
-- belongs to her own queendom and stays hidden like the other queens.
UPDATE public.agents
   SET queendom = 'sanika'
 WHERE lower(btrim(name)) = 'sanika ahire';

INSERT INTO public.agents (name, queendom, role, sort_order) VALUES
  ('Kshathriya C C A', 'sanika', 'agent', 1),
  ('Shanaya Javeri',   'sanika', 'agent', 2),
  ('Depender Kaur',    'sanika', 'agent', 3)
ON CONFLICT DO NOTHING;

-- PostgREST caches the schema; new/changed functions need a reload before the
-- REST/RPC surface sees them.
NOTIFY pgrst, 'reload schema';
