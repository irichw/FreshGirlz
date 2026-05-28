-- ============================================================
-- FreshGirlz — Migration : RDV côté cliente + notifications
-- Colle ce SQL dans Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ─────────────────────────────────────────────
-- 0. Activer RLS sur appointments (idempotent)
-- ─────────────────────────────────────────────
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- 1. Policies SELECT sur appointments
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "appointments: lecture coiffeuse"       ON appointments;
DROP POLICY IF EXISTS "appointments: lecture cliente"         ON appointments;
DROP POLICY IF EXISTS "appointments: lecture disponibilités"  ON appointments;

-- Coiffeuse voit tous ses RDV
CREATE POLICY "appointments: lecture coiffeuse" ON appointments
  FOR SELECT USING (
    coiffeuse_id IN (SELECT id FROM coiffeuses WHERE user_id = auth.uid())
  );

-- Cliente voit ses propres RDV
CREATE POLICY "appointments: lecture cliente" ON appointments
  FOR SELECT USING (
    cliente_id IN (SELECT id FROM clientes WHERE user_id = auth.uid())
  );

-- N'importe quel utilisateur auth peut lire les créneaux d'une coiffeuse
-- (nécessaire pour afficher les slots pris côté client lors de la réservation)
CREATE POLICY "appointments: lecture disponibilités" ON appointments
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────
-- 2. Policy INSERT pour les clientes
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "appointments: insertion par la cliente" ON appointments;

CREATE POLICY "appointments: insertion par la cliente" ON appointments
  FOR INSERT WITH CHECK (
    cliente_id IN (SELECT id FROM clientes WHERE user_id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- 3. Policy UPDATE : cliente peut annuler ses propres RDV
--    Coiffeuse peut modifier le statut de ses RDV
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "appointments: annulation par la cliente"   ON appointments;
DROP POLICY IF EXISTS "appointments: modification par la coiffeuse" ON appointments;

CREATE POLICY "appointments: annulation par la cliente" ON appointments
  FOR UPDATE USING (
    cliente_id IN (SELECT id FROM clientes WHERE user_id = auth.uid())
  );

CREATE POLICY "appointments: modification par la coiffeuse" ON appointments
  FOR UPDATE USING (
    coiffeuse_id IN (SELECT id FROM coiffeuses WHERE user_id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- 4. Notifications : tout utilisateur auth peut en insérer
--    (pour que les clientes puissent notifier les coiffeuses)
-- ─────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications: insert authenticated" ON notifications;
DROP POLICY IF EXISTS "notifications: lecture destinataire"  ON notifications;
DROP POLICY IF EXISTS "notifications: marquer lue"          ON notifications;

CREATE POLICY "notifications: insert authenticated" ON notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "notifications: lecture destinataire" ON notifications
  FOR SELECT USING (recipient_user_id = auth.uid());

CREATE POLICY "notifications: marquer lue" ON notifications
  FOR UPDATE USING (recipient_user_id = auth.uid());

-- ─────────────────────────────────────────────
-- 5. unavailable_days : lecture publique pour les clientes
--    (pour griser les jours indispos dans le sélecteur de RDV)
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "unavailable_days: lecture publique" ON unavailable_days;

CREATE POLICY "unavailable_days: lecture publique" ON unavailable_days
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────
-- 6. Colonne reference_url sur appointments
--    (photo de référence envoyée par la cliente)
-- ─────────────────────────────────────────────
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reference_url text;
