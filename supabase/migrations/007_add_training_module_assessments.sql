-- Migration: Training module assessment persistence
-- Stores module assessment submissions in Supabase for authenticated users.

create table if not exists public.training_module_assessments (
  id              text primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  module_slug     text not null references public.training_modules(slug) on delete cascade,
  assessment_type text not null,
  payload         jsonb not null default '{}',
  created_at      timestamptz not null default now()
);

alter table public.training_module_assessments enable row level security;

create policy "Users can insert own training assessments"
  on public.training_module_assessments
  for insert
  with check (auth.uid() = user_id);

create policy "Users can view own training assessments"
  on public.training_module_assessments
  for select
  using (auth.uid() = user_id);
