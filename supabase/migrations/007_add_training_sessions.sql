-- Foresight – persisted training sessions for academy modules
-- Run this migration from the Supabase SQL editor or via the CLI:
--   supabase db push

create table if not exists public.training_sessions (
  id           text primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  module_id    text not null,
  started_at   timestamptz not null,
  completed_at timestamptz,
  week_number  integer not null,
  drill_results jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists training_sessions_user_id_idx
  on public.training_sessions (user_id);

create index if not exists training_sessions_user_module_idx
  on public.training_sessions (user_id, module_id);

alter table public.training_sessions enable row level security;

create policy "Users manage their own training sessions"
  on public.training_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
