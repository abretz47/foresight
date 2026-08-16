-- Migration: Sync entitlements into auth.users raw_app_meta_data
-- Ensures user_id is not uniquely constrained on its own, and keeps the
-- auth metadata entitlements array in sync with public.user_entitlements.

alter table public.user_entitlements
  drop constraint if exists user_entitlements_user_id_key;

drop index if exists public.user_entitlements_user_id_key;

create index if not exists user_entitlements_user_id_idx
  on public.user_entitlements (user_id);

create or replace function public.refresh_auth_user_entitlements(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  new_entitlements jsonb := '[]'::jsonb;
begin
  select coalesce(jsonb_agg(entitlement_key order by entitlement_key), '[]'::jsonb)
    into new_entitlements
  from (
    select distinct ue.entitlement_key
    from public.user_entitlements ue
    where ue.user_id = target_user_id
  ) entitlements;

  update auth.users
  set raw_app_meta_data = jsonb_set(
    coalesce(raw_app_meta_data, '{}'::jsonb),
    '{entitlements}',
    new_entitlements,
    true
  )
  where id = target_user_id;
end;
$$;

create or replace function public.sync_user_entitlements_to_auth_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.refresh_auth_user_entitlements(new.user_id);
  elsif tg_op = 'DELETE' then
    perform public.refresh_auth_user_entitlements(old.user_id);
  elsif tg_op = 'UPDATE' then
    perform public.refresh_auth_user_entitlements(new.user_id);

    if old.user_id <> new.user_id then
      perform public.refresh_auth_user_entitlements(old.user_id);
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_user_entitlements_to_auth_metadata on public.user_entitlements;

create trigger sync_user_entitlements_to_auth_metadata
after insert or delete or update of user_id, entitlement_key on public.user_entitlements
for each row
execute function public.sync_user_entitlements_to_auth_metadata();

with aggregated_entitlements as (
  select ue.user_id,
         jsonb_agg(ue.entitlement_key order by ue.entitlement_key) as entitlements
  from (
    select distinct user_id, entitlement_key
    from public.user_entitlements
  ) ue
  group by ue.user_id
),
users_to_sync as (
  select id as user_id
  from auth.users
  where coalesce(raw_app_meta_data, '{}'::jsonb) ? 'entitlements'

  union

  select user_id
  from aggregated_entitlements
)
update auth.users as u
set raw_app_meta_data = jsonb_set(
  coalesce(u.raw_app_meta_data, '{}'::jsonb),
  '{entitlements}',
  coalesce(a.entitlements, '[]'::jsonb),
  true
)
from users_to_sync s
left join aggregated_entitlements a
  on a.user_id = s.user_id
where u.id = s.user_id;
