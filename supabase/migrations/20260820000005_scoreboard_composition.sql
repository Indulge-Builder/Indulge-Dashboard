-- Agent composition + period resolution average (2026-08-20 evening):
-- the agent bar becomes a stacked composition of the period's tickets —
-- resolved / overdue / incomplete / pending-rest — and resolution time is
-- the AVERAGE of (resolved_at - created_at) over the period cohort
-- (user-specified definition). Reopens also period-scoped.
-- overdue_p and incomplete_p partition the open cohort (escalated wins).

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
