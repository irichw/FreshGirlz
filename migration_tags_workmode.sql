-- ============================================================
-- FreshGirlz — Migration : work_mode coiffeuses + tagging photos
-- Colle ce SQL dans Supabase Dashboard → SQL Editor → Run
-- Safe à relancer plusieurs fois (IF NOT EXISTS partout)
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. Colonne work_mode sur coiffeuses
--    'salon'    → travaille dans un salon (lié via salon_id)
--    'domicile' → se déplace chez les clientes
-- ─────────────────────────────────────────────
ALTER TABLE coiffeuses
  ADD COLUMN IF NOT EXISTS work_mode TEXT DEFAULT 'salon'
    CHECK (work_mode IN ('salon', 'domicile'));

-- Rétro-compat : celles qui ont déjà un salon_id = mode salon
UPDATE coiffeuses SET work_mode = 'salon'    WHERE salon_id IS NOT NULL AND work_mode IS NULL;
UPDATE coiffeuses SET work_mode = 'domicile' WHERE salon_id IS NULL     AND work_mode IS NULL;

-- ─────────────────────────────────────────────
-- 2. Colonnes stats manquantes sur coupes
--    (views et likes existent probablement déjà)
-- ─────────────────────────────────────────────
ALTER TABLE coupes
  ADD COLUMN IF NOT EXISTS views              INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS likes              INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inspirations_count INTEGER DEFAULT 0;

-- ─────────────────────────────────────────────
-- 2b. Colonne time sur appointments (heure du RDV)
-- ─────────────────────────────────────────────
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS time TEXT; -- format 'HH:MM', ex: '14:30'

-- ─────────────────────────────────────────────
-- 2c. Prix enrichis sur services
--   price_type : 'fixed'  → un prix unique (price_min)
--                'range'  → fourchette price_min – price_max
--                'from'   → à partir de price_min
--   price_min / price_max remplacent l'ancien champ price
--   On garde price pour rétro-compat (ServicesManagementScreen existant)
-- ─────────────────────────────────────────────
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS price_type TEXT DEFAULT 'fixed'
    CHECK (price_type IN ('fixed', 'range', 'from')),
  ADD COLUMN IF NOT EXISTS price_min  NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS price_max  NUMERIC(8,2);

-- Migrer l'ancien champ price → price_min pour les lignes existantes
UPDATE services
SET price_min = price, price_type = 'fixed'
WHERE price_min IS NULL AND price IS NOT NULL AND price > 0;

-- ─────────────────────────────────────────────
-- 3. TABLE coupe_tags — tagging de clientes et coiffeuses sur les photos
--    Une ligne = un tag sur une photo
--    Soit tagged_client_id, soit tagged_coiffeuse_id (jamais les deux ensemble)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupe_tags (
  id                   UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  coupe_id             UUID REFERENCES coupes(id) ON DELETE CASCADE NOT NULL,
  tagged_client_id     UUID REFERENCES clientes(id) ON DELETE CASCADE,
  tagged_coiffeuse_id  UUID REFERENCES coiffeuses(id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT one_tag_type CHECK (
    (tagged_client_id IS NOT NULL AND tagged_coiffeuse_id IS NULL) OR
    (tagged_client_id IS NULL     AND tagged_coiffeuse_id IS NOT NULL)
  )
);

-- ─────────────────────────────────────────────
-- 4. RLS — coupe_tags
-- ─────────────────────────────────────────────
ALTER TABLE coupe_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coupe_tags: lecture publique"                  ON coupe_tags;
DROP POLICY IF EXISTS "coupe_tags: création par utilisateur auth"     ON coupe_tags;
DROP POLICY IF EXISTS "coupe_tags: suppression par créateur"          ON coupe_tags;
DROP POLICY IF EXISTS "coupe_tags: suppression par créateur ou tagué" ON coupe_tags;

-- N'importe qui peut lire les tags (pour afficher dans le feed et les photos)
CREATE POLICY "coupe_tags: lecture publique"
  ON coupe_tags FOR SELECT USING (true);

-- Un utilisateur authentifié peut taguer
CREATE POLICY "coupe_tags: création par utilisateur auth"
  ON coupe_tags FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- On peut retirer un tag si on est l'auteur de la coupe ou la personne taguée
CREATE POLICY "coupe_tags: suppression par créateur ou tagué"
  ON coupe_tags FOR DELETE USING (
    auth.uid() IS NOT NULL AND (
      -- auteur de la coupe
      coupe_id IN (
        SELECT c.id FROM coupes c
        LEFT JOIN clientes cl ON cl.id = c.client_id
        LEFT JOIN coiffeuses co ON co.id = c.barber_id
        WHERE cl.user_id = auth.uid() OR co.user_id = auth.uid()
      )
      OR
      -- cliente taguée
      tagged_client_id IN (SELECT id FROM clientes WHERE user_id = auth.uid())
      OR
      -- coiffeuse taguée
      tagged_coiffeuse_id IN (SELECT id FROM coiffeuses WHERE user_id = auth.uid())
    )
  );

-- ─────────────────────────────────────────────
-- 5. Fonction RPC pour incrémenter inspirations_count
--    (analogue à increment_coupe_views déjà existante)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_coupe_inspirations(p_coupe_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE coupes SET inspirations_count = COALESCE(inspirations_count, 0) + 1
  WHERE id = p_coupe_id;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_coupe_inspirations(p_coupe_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE coupes SET inspirations_count = GREATEST(0, COALESCE(inspirations_count, 0) - 1)
  WHERE id = p_coupe_id;
END;
$$;

-- ─────────────────────────────────────────────
-- 6. Index
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_coupe_tags_coupe      ON coupe_tags (coupe_id);
CREATE INDEX IF NOT EXISTS idx_coupe_tags_client     ON coupe_tags (tagged_client_id)    WHERE tagged_client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_coupe_tags_coiffeuse  ON coupe_tags (tagged_coiffeuse_id) WHERE tagged_coiffeuse_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_coiffeuses_work_mode  ON coiffeuses (work_mode);
