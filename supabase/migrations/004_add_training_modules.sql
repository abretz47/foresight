-- Migration: Paid Training Modules
-- Creates tables for training module catalog, configs, and user entitlements.

-- ── training_modules ─────────────────────────────────────────────────────────
-- Public catalog metadata (no entitlement required to list).
create table if not exists public.training_modules (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  description   text not null default '',
  thumbnail_url text,
  stripe_price_id text,
  component_key text not null,
  sort_order    integer not null default 0,
  is_published  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── training_module_configs ───────────────────────────────────────────────────
-- Entitlement-gated drill manifests served by the Edge Function.
create table if not exists public.training_module_configs (
  id          uuid primary key default gen_random_uuid(),
  module_slug text not null references public.training_modules(slug) on delete cascade,
  version     integer not null default 1,
  manifest    jsonb not null default '{}',
  published_at timestamptz,
  is_active   boolean not null default false,
  unique (module_slug, version)
);

-- ── user_entitlements ─────────────────────────────────────────────────────────
-- Records entitlements granted (via Stripe webhook or admin SQL).
-- stripe_event_id unique constraint ensures idempotency.
create table if not exists public.user_entitlements (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  entitlement_key text not null,
  granted_at      timestamptz not null default now(),
  source          text not null default 'stripe',
  stripe_event_id text unique,
  unique (user_id, entitlement_key)
);

-- RLS: users can read their own entitlements; inserts via service role only.
alter table public.user_entitlements enable row level security;
create policy "Users can view own entitlements"
  on public.user_entitlements for select
  using (auth.uid() = user_id);

-- training_modules is public read (catalog browsing requires no auth).
alter table public.training_modules enable row level security;
create policy "Anyone can read published modules"
  on public.training_modules for select
  using (is_published = true);

-- training_module_configs are read only via the Edge Function (service role).
alter table public.training_module_configs enable row level security;
create policy "Service role can manage configs"
  on public.training_module_configs for all
  using (auth.role() = 'service_role');

-- Seed: stub test module for OSS framework validation.
insert into public.training_modules (slug, title, description, component_key, sort_order, is_published)
values ('test-drill', 'Test Drill', 'A stub drill for validating the training framework.', 'test-drill', 0, true)
on conflict (slug) do nothing;

insert into public.training_module_configs (module_slug, version, manifest, published_at, is_active)
values (
  'test-drill',
  1,
  '{
    "title": "Test Drill",
    "description": "Stub drill for framework validation.",
    "version": 1,
    "estimatedDurationMinutes": 5,
    "steps": [
      {"id": "step-1", "instruction": "Stand at the target line.", "completionCriteria": "manual"},
      {"id": "step-2", "instruction": "Take 5 practice swings.", "completionCriteria": "manual"}
    ],
    "parameters": {},
    "assets": {}
  }',
  now(),
  true
)
on conflict (module_slug, version) do nothing;
