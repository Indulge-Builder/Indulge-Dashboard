-- Founder insight aggregations (2026-08-20). All day-bucketing is IST.
-- Event math by design (resolved counted on resolution date) — the TV's
-- cohort math is a different, deliberate definition; these are labeled
-- founder analytics, not TV widgets.

create or replace function public.insights_pulse(p_days int default 30)
returns jsonb language sql stable as $$
with tz as (select 'Asia/Kolkata'::text as z),
open_now as (
  select * from tickets
  where lower(status) not in ('resolved','closed','spam','deleted')
),
daily as (
  select d::date as day,
    (select count(*) from tickets t where (t.created_at at time zone (select z from tz))::date = d::date
       and lower(t.status) not in ('spam','deleted')) as created,
    (select count(*) from tickets t where (t.resolved_at at time zone (select z from tz))::date = d::date) as resolved
  from generate_series(
    (now() at time zone (select z from tz))::date - (p_days - 1),
    (now() at time zone (select z from tz))::date, '1 day') d
),
hourly as (
  select extract(hour from t.created_at at time zone (select z from tz))::int as h, count(*) as n
  from tickets t
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
  'reopened', (select count(*) from tickets where reopened_at > now() - make_interval(days => p_days))
)
$$;

create or replace function public.insights_agents(p_days int default 30)
returns jsonb language sql stable as $$
select coalesce(jsonb_agg(row order by (row->>'resolved')::int desc), '[]'::jsonb) from (
  select jsonb_build_object(
    'name', agent_name,
    'queendom', queendom_name,
    'resolved', count(*) filter (where resolved_at > now() - make_interval(days => p_days)),
    'median_frt_min', round((extract(epoch from percentile_cont(0.5) within group
        (order by first_responded_at - created_at)
        filter (where first_responded_at is not null and first_responded_at > created_at
                and created_at > now() - make_interval(days => p_days)) ) / 60)::numeric),
    'p90_frt_min', round((extract(epoch from percentile_cont(0.9) within group
        (order by first_responded_at - created_at)
        filter (where first_responded_at is not null and first_responded_at > created_at
                and created_at > now() - make_interval(days => p_days)) ) / 60)::numeric),
    'median_res_hr', round((extract(epoch from percentile_cont(0.5) within group
        (order by resolved_at - created_at)
        filter (where resolved_at is not null and resolved_at > created_at
                and resolved_at > now() - make_interval(days => p_days)) ) / 3600)::numeric, 1),
    'reopens', count(*) filter (where reopened_at > now() - make_interval(days => p_days)),
    'open_now', count(*) filter (where lower(status) not in ('resolved','closed','spam','deleted')),
    'billable', count(*) filter (where is_billable and created_at > now() - make_interval(days => p_days))
  ) as row
  from tickets
  where agent_name is not null and lower(status) not in ('spam','deleted')
  group by agent_name, queendom_name
  having count(*) filter (where resolved_at > now() - make_interval(days => p_days)) > 0
      or count(*) filter (where lower(status) not in ('resolved','closed','spam','deleted')) > 0
) x
$$;

create or replace function public.insights_mix(p_days int default 30)
returns jsonb language sql stable as $$
with scope as (
  select * from tickets
  where created_at > now() - make_interval(days => p_days)
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
    'client', coalesce(c.name, 'Contact ' || t.requester_id::text),
    'tickets', count(*),
    'open', count(*) filter (where lower(t.status) not in ('resolved','closed','spam','deleted')),
    'urgent', count(*) filter (where t.priority = 4),
    'types', (array_agg(distinct t.ticket_type) filter (where t.ticket_type is not null))[1:3]
  ) as row
  from tickets t
  left join clients c on c.freshdesk_contact_id ~ '^[0-9]+$'
                     and c.freshdesk_contact_id::bigint = t.requester_id
  where t.requester_id is not null
    and t.created_at > now() - make_interval(days => p_days)
    and lower(t.status) not in ('spam','deleted')
  group by t.requester_id, c.name
  order by count(*) desc
  limit 12
) x
$$;

create or replace function public.insights_csat(p_days int default 90)
returns jsonb language sql stable as $$
select jsonb_build_object(
  'count', (select count(*) from csat_ratings where created_at > now() - make_interval(days => p_days)),
  'happy_pct', (select round(100.0 * count(*) filter (where rating > 100) / nullif(count(*),0))
                from csat_ratings where created_at > now() - make_interval(days => p_days)),
  'weekly', (select coalesce(jsonb_agg(jsonb_build_object('w', w, 'happy', happy, 'total', total) order by w), '[]'::jsonb)
             from (select date_trunc('week', created_at)::date w,
                          count(*) filter (where rating > 100) happy, count(*) total
                   from csat_ratings where created_at > now() - make_interval(days => p_days)
                   group by 1) t),
  'recent_low', (select coalesce(jsonb_agg(jsonb_build_object(
                   'ticket_id', ticket_id, 'agent', agent_name, 'label', rating_label,
                   'feedback', left(coalesce(feedback,''), 90), 'at', created_at) order by created_at desc), '[]'::jsonb)
                 from (select * from csat_ratings where rating < 100
                       order by created_at desc limit 5) t)
)
$$;
