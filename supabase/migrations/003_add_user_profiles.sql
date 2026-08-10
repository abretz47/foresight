-- Foresight – add cloud storage for UserSetup profile fields.
-- Stores the first-run player profile captured in UserSetup.tsx.

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id     UUID        NOT NULL PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  age         TEXT,
  handicap    TEXT,
  units       TEXT        NOT NULL DEFAULT 'imperial' CHECK (units IN ('imperial', 'metric')),
  hand_width  TEXT,
  arm_length  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own user profile"
  ON user_profiles
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
