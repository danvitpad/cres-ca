-- Phase 7: formalize the client_health_profiles table and let clients read/write their own row.
-- The table was referenced in migration 00019 (master read policy) and in booking code,
-- but was never explicitly created via migration. This makes it idempotent.

CREATE TABLE IF NOT EXISTS client_health_profiles (
  profile_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  allergies text[] NOT NULL DEFAULT '{}',
  chronic_conditions text[] NOT NULL DEFAULT '{}',
  medications text[] NOT NULL DEFAULT '{}',
  pregnancy boolean NOT NULL DEFAULT false,
  contraindications text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE client_health_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients manage own health profile" ON client_health_profiles;
CREATE POLICY "Clients manage own health profile"
  ON client_health_profiles FOR ALL
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
