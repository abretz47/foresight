-- Foresight – initial schema for Supabase (self-hosted)
-- Run this migration from the Supabase SQL editor or via the CLI:
--   supabase db push  (if using the Supabase CLI)
-- or paste directly into the SQL editor in your Supabase dashboard.

-- ─── shot_profiles ─────────────────────────────────────────────────────────
-- Mirrors the local AsyncStorage shot-profile structure.
CREATE TABLE IF NOT EXISTS shot_profiles (
  id           TEXT        NOT NULL PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  distance     TEXT        NOT NULL DEFAULT '',
  target_radius TEXT       NOT NULL DEFAULT '',
  miss_radius  TEXT        NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index to speed up per-user queries.
CREATE INDEX IF NOT EXISTS shot_profiles_user_id_idx ON shot_profiles (user_id);

-- Row-Level Security: users can only see and modify their own profiles.
ALTER TABLE shot_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own shot profiles"
  ON shot_profiles
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── data_points ────────────────────────────────────────────────────────────
-- Mirrors the local AsyncStorage data-point structure.
CREATE TABLE IF NOT EXISTS data_points (
  id            TEXT        NOT NULL PRIMARY KEY,
  profile_id    TEXT        NOT NULL REFERENCES shot_profiles (id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  shot_x        FLOAT       NOT NULL,
  shot_y        FLOAT       NOT NULL,
  clicked_from  TEXT        NOT NULL DEFAULT '',
  screen_height FLOAT,
  screen_width  FLOAT,
  off_target    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes to speed up per-profile and per-user queries.
CREATE INDEX IF NOT EXISTS data_points_profile_id_idx ON data_points (profile_id);
CREATE INDEX IF NOT EXISTS data_points_user_id_idx    ON data_points (user_id);

-- Row-Level Security: users can only see and modify their own data points.
ALTER TABLE data_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own data points"
  ON data_points
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
