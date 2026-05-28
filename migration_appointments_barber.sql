-- ============================================================
-- FreshGirlz — Migration : RDV coiffeuse (schéma corrigé)
-- Colle ce SQL dans Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. Supprimer les policies qui dépendent de barber_id / client_id
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "appointments: insertion par la coiffeuse"             ON appointments;
DROP POLICY IF EXISTS "appointments: lecture coiffeuse (barber_id)"          ON appointments;
DROP POLICY IF EXISTS "appointments: modification par la coiffeuse (barber_id)" ON appointments;

-- ─────────────────────────────────────────────
-- 2. Supprimer les colonnes mal nommées
-- ─────────────────────────────────────────────
ALTER TABLE appointments DROP COLUMN IF EXISTS barber_id;
ALTER TABLE appointments DROP COLUMN IF EXISTS client_id;

-- ─────────────────────────────────────────────
-- 2. Rendre cliente_id nullable
--    (RDVs créés manuellement par la coiffeuse, sans compte cliente)
-- ─────────────────────────────────────────────
ALTER TABLE appointments ALTER COLUMN cliente_id  DROP NOT NULL;
ALTER TABLE appointments ALTER COLUMN date_debut  DROP NOT NULL;

-- ─────────────────────────────────────────────
-- 3. Ajouter les colonnes vraiment nouvelles
-- ─────────────────────────────────────────────
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status       TEXT DEFAULT 'pending'
                                        CHECK (status IN ('pending','confirmed','done','cancelled','no_show')),
  ADD COLUMN IF NOT EXISTS client_name  TEXT,
  ADD COLUMN IF NOT EXISTS service      TEXT,
  ADD COLUMN IF NOT EXISTS duration     INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS time         TEXT;

-- ─────────────────────────────────────────────
-- 4. Migrer date_debut / statut vers les nouvelles colonnes
-- ─────────────────────────────────────────────
UPDATE appointments
  SET scheduled_at = date_debut,
      status       = statut
  WHERE scheduled_at IS NULL;

-- ─────────────────────────────────────────────
-- 5. Politique INSERT pour les coiffeuses (via coiffeuse_id)
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "appointments: insertion par la coiffeuse" ON appointments;

CREATE POLICY "appointments: insertion par la coiffeuse"
  ON appointments FOR INSERT WITH CHECK (
    coiffeuse_id IN (SELECT id FROM coiffeuses WHERE user_id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- 6. Colonnes price_type / price_min / price_max sur services
-- ─────────────────────────────────────────────
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS price_type TEXT DEFAULT 'fixed'
    CHECK (price_type IN ('fixed', 'range', 'from')),
  ADD COLUMN IF NOT EXISTS price_min  NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS price_max  NUMERIC(8,2);

UPDATE services
  SET price_min = price
  WHERE price_min IS NULL AND price IS NOT NULL AND price > 0;

-- ─────────────────────────────────────────────
-- 7. Index
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_appointments_coiffeuse ON appointments (coiffeuse_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_cliente   ON appointments (cliente_id);
