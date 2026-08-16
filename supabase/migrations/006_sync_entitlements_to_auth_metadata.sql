-- Migration: Sync entitlements into auth.users raw_app_meta_data
-- Ensures user_id is not uniquely constrained on its own, and keeps the
-- auth metadata entitlements array in sync with public.user_entitlements.

alter table public.user_entitlements
  drop constraint if exists user_entitlements_user_id_key;

drop index if exists public.user_entitlements_user_id_key;

create index if not exists user_entitlements_user_id_idx
  on public.user_entitlements (user_id);

create or replace function public.sync_user_entitlements_to_auth_metadata()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_entitlements jsonb := '[]'::jsonb;
begin
  if tg_op in ('INSERT', 'UPDATE') then
    select coalesce(jsonb_agg(entitlement_key order by entitlement_key), '[]'::jsonb)
      into new_entitlements
    from (
      select distinct ue.entitlement_key
      from public.user_entitlements ue
      where ue.user_id = new.user_id
    ) entitlements;

    update auth.users
    set raw_app_meta_data = jsonb_set(
      coalesce(raw_app_meta_data, '{}'::jsonb),
      '{entitlements}',
      new_entitlements,
      true
    )
    where id = new.user_id;
  end if;

  if tg_op in ('DELETE', 'UPDATE') then
    select coalesce(jsonb_agg(entitlement_key order by entitlement_key), '[]'::jsonb)
      into new_entitlements
    from (
      select distinct ue.entitlement_key
      from public.user_entitlements ue
      where ue.user_id = old.user_id
    ) entitlements;

    update auth.users
    set raw_app_meta_data = jsonb_set(
      coalesce(raw_app_meta_data, '{}'::jsonb),
      '{entitlements}',
      new_entitlements,
      true
    )
    where id = old.user_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_user_entitlements_to_auth_metadata on public.user_entitlements;

create trigger sync_user_entitlements_to_auth_metadata
after insert or update or delete on public.user_entitlements
for each row
execute function public.sync_user_entitlements_to_auth_metadata();
