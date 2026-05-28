-- ============================================================
-- FreshGirlz — Migration : jours indisponibles coiffeuse
-- Colle ce SQL dans Supabase Dashboard → SQL Editor → Run
-- ============================================================

CREATE TABLE IF NOT EXISTS unavailable_days (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  coiffeuse_id  UUID REFERENCES coiffeuses(id) ON DELETE CASCADE NOT NULL,
  date          TEXT NOT NULL,  -- format 'YYYY-MM-DD'
  reason        TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (coiffeuse_id, date)
);

ALTER TABLE unavailable_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unavailable_days: lecture coiffeuse" ON unavailable_days;
DROP POLICY IF EXISTS "unavailable_days: insert coiffeuse"  ON unavailable_days;
DROP POLICY IF EXISTS "unavailable_days: delete coiffeuse"  ON unavailable_days;

CREATE POLICY "unavailable_days: lecture coiffeuse" ON unavailable_days
  FOR SELECT USING (
    coiffeuse_id IN (SELECT id FROM coiffeuses WHERE user_id = auth.uid())
  );

CREATE POLICY "unavailable_days: insert coiffeuse" ON unavailable_days
  FOR INSERT WITH CHECK (
    coiffeuse_id IN (SELECT id FROM coiffeuses WHERE user_id = auth.uid())
  );

CREATE POLICY "unavailable_days: delete coiffeuse" ON unavailable_days
  FOR DELETE USING (
    coiffeuse_id IN (SELECT id FROM coiffeuses WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_unavailable_days_coiffeuse ON unavailable_days (coiffeuse_id, date);
