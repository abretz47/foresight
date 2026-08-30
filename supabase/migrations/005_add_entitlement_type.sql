-- Migration: Add type column to user_entitlements
-- Adds a `type` field so entitlements can be categorised (e.g. 'training').
-- Existing rows default to 'training' since all current entitlements are
-- training-module entitlements.

alter table public.user_entitlements
  add column if not exists type text not null default 'training';
