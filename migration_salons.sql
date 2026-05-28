-- ============================================================
-- FreshGirlz — Migration : tables Salon + colonnes manquantes
-- Colle ce SQL dans Supabase Dashboard → SQL Editor → Run
-- Safe à relancer plusieurs fois (IF NOT EXISTS partout)
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. TABLE salons
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS salons (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  phone       TEXT,
  instagram   TEXT,
  address     TEXT,
  postal_code TEXT,
  city        TEXT,
  latitude    DOUBLE PRECISION,
  longitude   DOUBLE PRECISION,
  is_open     BOOLEAN DEFAULT FALSE,
  photo_url   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 2. Colonnes manquantes dans coiffeuses
-- ─────────────────────────────────────────────
ALTER TABLE coiffeuses
  ADD COLUMN IF NOT EXISTS salon_id     UUID REFERENCES salons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS role         TEXT DEFAULT 'coiffeuse' CHECK (role IN ('manager','coiffeuse')),
  ADD COLUMN IF NOT EXISTS queue_locked BOOLEAN DEFAULT FALSE;

-- ─────────────────────────────────────────────
-- 3. TABLE salon_photos
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS salon_photos (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  salon_id   UUID REFERENCES salons(id) ON DELETE CASCADE NOT NULL,
  photo_url  TEXT NOT NULL,
  position   INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 4. TABLE salon_invites
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS salon_invites (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  salon_id   UUID REFERENCES salons(id) ON DELETE CASCADE NOT NULL,
  code       TEXT NOT NULL UNIQUE,
  is_used    BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 5. TABLE services
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  salon_id         UUID REFERENCES salons(id) ON DELETE CASCADE NOT NULL,
  name             TEXT NOT NULL,
  price            NUMERIC(8,2) DEFAULT 0,
  duration_minutes INTEGER DEFAULT 30,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 6. TABLE opening_hours
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS opening_hours (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  salon_id    UUID REFERENCES salons(id) ON DELETE CASCADE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time   TEXT NOT NULL,
  close_time  TEXT NOT NULL,
  is_closed   BOOLEAN DEFAULT FALSE,
  UNIQUE (salon_id, day_of_week)
);

-- ─────────────────────────────────────────────
-- 7. RLS — salons
-- ─────────────────────────────────────────────
ALTER TABLE salons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "salons: lecture publique"                    ON salons;
DROP POLICY IF EXISTS "salons: insertion par utilisateur authentifié" ON salons;
DROP POLICY IF EXISTS "salons: modification par le manager"         ON salons;

CREATE POLICY "salons: lecture publique"
  ON salons FOR SELECT USING (true);

CREATE POLICY "salons: insertion par utilisateur authentifié"
  ON salons FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "salons: modification par le manager"
  ON salons FOR UPDATE USING (
    id IN (SELECT salon_id FROM coiffeuses WHERE user_id = auth.uid() AND role = 'manager')
  );

-- ─────────────────────────────────────────────
-- 8. RLS — salon_photos
-- ─────────────────────────────────────────────
ALTER TABLE salon_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "salon_photos: lecture publique"      ON salon_photos;
DROP POLICY IF EXISTS "salon_photos: gestion par le manager" ON salon_photos;

CREATE POLICY "salon_photos: lecture publique"
  ON salon_photos FOR SELECT USING (true);

CREATE POLICY "salon_photos: gestion par le manager"
  ON salon_photos FOR ALL USING (
    salon_id IN (SELECT salon_id FROM coiffeuses WHERE user_id = auth.uid() AND role = 'manager')
  );

-- ─────────────────────────────────────────────
-- 9. RLS — salon_invites
-- ─────────────────────────────────────────────
ALTER TABLE salon_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "salon_invites: lecture par code (tout le monde)" ON salon_invites;
DROP POLICY IF EXISTS "salon_invites: insertion par le manager"          ON salon_invites;
DROP POLICY IF EXISTS "salon_invites: modification (marquer utilisé)"   ON salon_invites;

CREATE POLICY "salon_invites: lecture par code (tout le monde)"
  ON salon_invites FOR SELECT USING (true);

CREATE POLICY "salon_invites: insertion par le manager"
  ON salon_invites FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "salon_invites: modification (marquer utilisé)"
  ON salon_invites FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────
-- 10. RLS — services
-- ─────────────────────────────────────────────
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "services: lecture publique"         ON services;
DROP POLICY IF EXISTS "services: gestion par le manager"  ON services;

CREATE POLICY "services: lecture publique"
  ON services FOR SELECT USING (true);

CREATE POLICY "services: gestion par le manager"
  ON services FOR ALL USING (
    salon_id IN (SELECT salon_id FROM coiffeuses WHERE user_id = auth.uid() AND role = 'manager')
  ) WITH CHECK (
    salon_id IN (SELECT salon_id FROM coiffeuses WHERE user_id = auth.uid() AND role = 'manager')
  );

-- ─────────────────────────────────────────────
-- 11. RLS — opening_hours
-- ─────────────────────────────────────────────
ALTER TABLE opening_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "opening_hours: lecture publique"        ON opening_hours;
DROP POLICY IF EXISTS "opening_hours: gestion par le manager" ON opening_hours;

CREATE POLICY "opening_hours: lecture publique"
  ON opening_hours FOR SELECT USING (true);

CREATE POLICY "opening_hours: gestion par le manager"
  ON opening_hours FOR ALL USING (
    salon_id IN (SELECT salon_id FROM coiffeuses WHERE user_id = auth.uid() AND role = 'manager')
  ) WITH CHECK (
    salon_id IN (SELECT salon_id FROM coiffeuses WHERE user_id = auth.uid() AND role = 'manager')
  );

-- ─────────────────────────────────────────────
-- 12. Index
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_coiffeuses_salon   ON coiffeuses (salon_id);
CREATE INDEX IF NOT EXISTS idx_salon_invites_code ON salon_invites (code) WHERE is_used = false;
CREATE INDEX IF NOT EXISTS idx_services_salon     ON services (salon_id) WHERE is_active = true;

-- ─────────────────────────────────────────────
-- 13. Bucket storage "Photos" (si absent)
-- ─────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('Photos', 'Photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Photos: lecture publique"                    ON storage.objects;
DROP POLICY IF EXISTS "Photos: upload par utilisateur authentifié"  ON storage.objects;

CREATE POLICY "Photos: lecture publique" ON storage.objects
  FOR SELECT USING (bucket_id = 'Photos');

CREATE POLICY "Photos: upload par utilisateur authentifié" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'Photos' AND auth.uid() IS NOT NULL);
