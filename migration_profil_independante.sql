-- ============================================================
-- FreshGirlz — Migration : Profil coiffeuse indépendante
-- Colle ce SQL dans Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. profile_type sur coiffeuses
-- ─────────────────────────────────────────────
ALTER TABLE coiffeuses
  ADD COLUMN IF NOT EXISTS profile_type TEXT
    CHECK (profile_type IN ('independante', 'employee', 'gerante'));

-- Migrer les valeurs existantes depuis role
UPDATE coiffeuses
SET profile_type = CASE role
  WHEN 'manager'   THEN 'gerante'
  WHEN 'coiffeuse' THEN 'employee'
END
WHERE profile_type IS NULL;

-- ─────────────────────────────────────────────
-- 2. Colonnes profil indépendante sur coiffeuses
-- ─────────────────────────────────────────────
ALTER TABLE coiffeuses
  ADD COLUMN IF NOT EXISTS nom_pro            TEXT,
  ADD COLUMN IF NOT EXISTS specialites        JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS work_modes         JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS ville              TEXT,
  ADD COLUMN IF NOT EXISTS intervention_zone  TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_done    BOOLEAN DEFAULT FALSE;

-- ─────────────────────────────────────────────
-- 3. Adapter la table services pour les indépendantes
--    salon_id devient nullable ; coiffeuse_id ajouté
-- ─────────────────────────────────────────────
ALTER TABLE services
  ALTER COLUMN salon_id DROP NOT NULL;

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS coiffeuse_id UUID REFERENCES coiffeuses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS description   TEXT;

-- ─────────────────────────────────────────────
-- 4. RLS sur services — lecture publique
-- ─────────────────────────────────────────────
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "services: lecture publique" ON services;
CREATE POLICY "services: lecture publique" ON services
  FOR SELECT USING (true);

-- Coiffeuse indépendante gère ses propres services
DROP POLICY IF EXISTS "services: gestion independante" ON services;
CREATE POLICY "services: gestion independante" ON services
  FOR ALL USING (
    coiffeuse_id IN (SELECT id FROM coiffeuses WHERE user_id = auth.uid())
  );

-- Gérante/manager gère les services de son salon
DROP POLICY IF EXISTS "services: gestion salon" ON services;
CREATE POLICY "services: gestion salon" ON services
  FOR ALL USING (
    salon_id IN (
      SELECT s.id FROM salons s
      JOIN coiffeuses c ON c.salon_id = s.id
      WHERE c.user_id = auth.uid() AND c.role = 'manager'
    )
  );
