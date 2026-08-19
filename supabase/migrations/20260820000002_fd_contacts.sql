-- Freshdesk contacts directory (2026-08-20). clients.freshdesk_contact_id
-- turned out to hold "Yes"/"No" flags, not ids — so member intelligence
-- joins tickets.requester_id to this synced directory instead.

create table if not exists public.fd_contacts (
  id         bigint primary key,          -- Freshdesk contact id
  name       text,
  email      text,
  company_id bigint,
  updated_at timestamptz default now()
);

alter table public.fd_contacts enable row level security;
drop policy if exists fd_contacts_anon_select on public.fd_contacts;
create policy fd_contacts_anon_select on public.fd_contacts for select to anon using (true);
drop policy if exists fd_contacts_auth_all on public.fd_contacts;
create policy fd_contacts_auth_all on public.fd_contacts for all to authenticated using (true) with check (true);

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
    and lower(t.status) not in ('spam','deleted')
  group by t.requester_id, fc.name, fc.email
  order by count(*) desc
  limit 12
) x
$$;

notify pgrst, 'reload schema';
