-- Period scoreboard for the mobile Concierge (2026-08-20): one function,
-- arbitrary [from, to) bounds — the mobile period filter (today / this week /
-- this month / last month) computes IST bounds and everything below it reads
-- from here. Cohort math (created_at anchors the period, CLAUDE.md #4).
--
-- "ontime" is the 125-target metric: resolved without going overdue =
-- terminal AND (no SLA clock OR resolved_at <= due_by).
-- Scope: live Queendoms + active roster agents only (2026-08-20 decision).

create or replace function public.insights_scoreboard(p_from timestamptz, p_to timestamptz)
returns jsonb language sql stable as $$
with scope as (
  select t.*,
    case when queendom_name ilike '%ananyshree%' then 'ananyshree' else 'anishqa' end as qid,
    (lower(status) in ('resolved','closed')) as is_terminal,
    (lower(status) in ('resolved','closed')
      and (due_by is null or resolved_at <= due_by)) as is_ontime
  from tickets t
  where created_at >= p_from and created_at < p_to
    and (queendom_name ilike '%ananyshree%' or queendom_name ilike '%anishqa%')
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
    count(*) filter (where s.ticket_id is not null and not s.is_terminal) as pending
  from roster r
  left join scope s on lower(trim(s.agent_name)) = lower(r.name)
  group by r.name, r.queendom
),
overdue_now as (
  -- carry-forward: open + escalated, ANY period (matches the TV's D2 rule)
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
      'overdue_open', coalesce(od.n, 0)
    ) order by pa.ontime desc, pa.resolved desc, pa.name), '[]'::jsonb)
    from per_agent pa
    left join overdue_now od on od.key = lower(pa.name)
  )
)
$$;
