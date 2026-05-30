-- ════════════════════════════════════════════
--  Smart Budget Pro — Supabase Database Schema
--  Run this in: Supabase Dashboard → SQL Editor
-- ════════════════════════════════════════════

-- ── Users table ──
CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  email               TEXT UNIQUE NOT NULL,
  tier                TEXT NOT NULL DEFAULT 'trial'
                        CHECK (tier IN ('trial','premium','expired','cancelled')),
  trial_start         TIMESTAMPTZ,
  trial_end           TIMESTAMPTZ,
  premium_since       TIMESTAMPTZ,
  payfast_payment_id  TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Payments table ──
CREATE TABLE IF NOT EXISTS payments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id   TEXT UNIQUE NOT NULL,
  email        TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('pending','complete','cancelled','failed')),
  amount       NUMERIC(10,2),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ── Budget data table (cloud sync for premium users) ──
CREATE TABLE IF NOT EXISTS budget_data (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT UNIQUE NOT NULL,
  data       JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Row Level Security ──
ALTER TABLE users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_data ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own row
CREATE POLICY "Users: own row only" ON users
  FOR ALL USING (auth.email() = email);

-- Budget data: own row only
CREATE POLICY "Budget: own data only" ON budget_data
  FOR ALL USING (auth.email() = email);

-- ── Auto-update updated_at ──
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at       BEFORE UPDATE ON users       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER budget_data_updated_at BEFORE UPDATE ON budget_data FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Helper view: trial status ──
CREATE OR REPLACE VIEW user_status AS
SELECT
  email, name, tier,
  trial_end,
  GREATEST(0, EXTRACT(DAY FROM trial_end - NOW()))::INT AS trial_days_left,
  premium_since,
  CASE
    WHEN tier = 'premium' THEN true
    WHEN tier = 'trial' AND trial_end > NOW() THEN true
    ELSE false
  END AS has_access
FROM users;
