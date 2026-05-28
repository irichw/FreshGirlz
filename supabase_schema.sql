-- ============================================================
-- FreshGirlz — Schéma Supabase complet
-- Colle ce SQL dans l'éditeur SQL de ton nouveau projet Supabase
-- ============================================================

-- ─────────────────────────────────────────────
-- EXTENSION UUID
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
-- TABLE : salons
-- ─────────────────────────────────────────────
CREATE TABLE salons (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  phone           TEXT,
  instagram       TEXT,
  address         TEXT,
  postal_code     TEXT,
  city            TEXT,
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  is_open         BOOLEAN DEFAULT FALSE,
  photo_url       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TABLE : clientes
-- ─────────────────────────────────────────────
CREATE TABLE clientes (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  bio             TEXT,
  avatar_url      TEXT,
  fresh_score     INTEGER DEFAULT 0,
  nb_avis_laissés INTEGER DEFAULT 0,
  push_token      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TABLE : coiffeuses
-- ─────────────────────────────────────────────
CREATE TABLE coiffeuses (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  salon_id        UUID REFERENCES salons(id) ON DELETE SET NULL,
  role            TEXT DEFAULT 'coiffeuse' CHECK (role IN ('manager', 'coiffeuse')),
  name            TEXT NOT NULL,
  bio             TEXT,
  avatar_url      TEXT,
  adresse         TEXT,
  ville           TEXT,
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  instagram       TEXT,
  specialites     TEXT[]    DEFAULT '{}',
  is_available    BOOLEAN   DEFAULT TRUE,
  booking_mode    TEXT      DEFAULT 'request' CHECK (booking_mode IN ('instant', 'request')),
  rating          NUMERIC(3,1) DEFAULT 0,
  nb_avis         INTEGER   DEFAULT 0,
  push_token      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TABLE : salon_photos
-- ─────────────────────────────────────────────
CREATE TABLE salon_photos (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  salon_id        UUID REFERENCES salons(id) ON DELETE CASCADE NOT NULL,
  photo_url       TEXT NOT NULL,
  position        INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TABLE : salon_invites (codes d'invitation équipe)
-- ─────────────────────────────────────────────
CREATE TABLE salon_invites (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  salon_id        UUID REFERENCES salons(id) ON DELETE CASCADE NOT NULL,
  code            TEXT NOT NULL UNIQUE,
  is_used         BOOLEAN DEFAULT FALSE,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TABLE : services (prestations rattachées au salon)
-- ─────────────────────────────────────────────
CREATE TABLE services (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  salon_id         UUID REFERENCES salons(id) ON DELETE CASCADE NOT NULL,
  name             TEXT NOT NULL,
  price            NUMERIC(8,2) DEFAULT 0,
  duration_minutes INTEGER DEFAULT 30,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TABLE : opening_hours (horaires du salon)
-- ─────────────────────────────────────────────
CREATE TABLE opening_hours (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  salon_id     UUID REFERENCES salons(id) ON DELETE CASCADE NOT NULL,
  day_of_week  INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time    TEXT NOT NULL,   -- ex: '09:00'
  close_time   TEXT NOT NULL,   -- ex: '19:00'
  is_closed    BOOLEAN DEFAULT FALSE,
  UNIQUE (salon_id, day_of_week)
);

-- ─────────────────────────────────────────────
-- TABLE : prestations (menu détaillé coiffeuse)
-- ─────────────────────────────────────────────
CREATE TABLE prestations (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  coiffeuse_id    UUID REFERENCES coiffeuses(id) ON DELETE CASCADE NOT NULL,
  nom             TEXT NOT NULL,
  categorie       TEXT NOT NULL,
  emoji           TEXT DEFAULT '💆',
  description     TEXT,
  prix_min        INTEGER DEFAULT 0,
  prix_max        INTEGER DEFAULT 0,
  duree_min       INTEGER DEFAULT 60,  -- durée minimale en minutes
  duree_max       INTEGER,             -- durée maximale en minutes (ex: 360 pour 6h)
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TABLE : appointments (rendez-vous)
-- ─────────────────────────────────────────────
CREATE TABLE appointments (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  coiffeuse_id    UUID REFERENCES coiffeuses(id) ON DELETE CASCADE NOT NULL,
  cliente_id      UUID REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
  prestation_id   UUID REFERENCES prestations(id) ON DELETE SET NULL,
  date_debut      TIMESTAMPTZ NOT NULL,
  date_fin        TIMESTAMPTZ,
  statut          TEXT DEFAULT 'pending' CHECK (statut IN ('pending','confirmed','done','cancelled','no_show')),
  notes           TEXT,
  prix_final      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TABLE : book_photos (portfolio coiffeuse)
-- ─────────────────────────────────────────────
CREATE TABLE book_photos (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  coiffeuse_id    UUID REFERENCES coiffeuses(id) ON DELETE CASCADE NOT NULL,
  cliente_id      UUID REFERENCES clientes(id) ON DELETE SET NULL,  -- cliente mise en avant sur la photo
  photo_url       TEXT NOT NULL,
  caption         TEXT,
  categorie       TEXT,
  likes           INTEGER DEFAULT 0,
  views           INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TABLE : avis (évaluations)
-- ─────────────────────────────────────────────
CREATE TABLE avis (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  coiffeuse_id    UUID REFERENCES coiffeuses(id) ON DELETE CASCADE NOT NULL,
  cliente_id      UUID REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
  appointment_id  UUID REFERENCES appointments(id) ON DELETE SET NULL,
  note            INTEGER NOT NULL CHECK (note BETWEEN 1 AND 5),
  commentaire     TEXT,
  photo_avant_url TEXT,
  photo_apres_url TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (coiffeuse_id, cliente_id, appointment_id)
);

-- ─────────────────────────────────────────────
-- TABLE : photo_partages (photos partagées par les clientes)
-- ─────────────────────────────────────────────
CREATE TABLE photo_partages (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cliente_id      UUID REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
  coiffeuse_id    UUID REFERENCES coiffeuses(id) ON DELETE SET NULL,
  photo_url       TEXT NOT NULL,
  caption         TEXT,
  likes           INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TABLE : photo_likes
-- ─────────────────────────────────────────────
CREATE TABLE photo_likes (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  photo_id        UUID NOT NULL,
  photo_type      TEXT NOT NULL CHECK (photo_type IN ('book', 'partage')),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (photo_id, photo_type, user_id)
);

-- ─────────────────────────────────────────────
-- TABLE : notifications
-- ─────────────────────────────────────────────
CREATE TABLE notifications (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type              TEXT NOT NULL,
  title             TEXT NOT NULL,
  body              TEXT,
  data              JSONB,
  read              BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- STORAGE BUCKETS
-- ─────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars',       'avatars',       true),
  ('book-photos',   'book-photos',   true),
  ('client-photos', 'client-photos', true),
  ('Photos',        'Photos',        true)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────
-- POLICIES RLS — salons
-- ─────────────────────────────────────────────
ALTER TABLE salons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salons: lecture publique"
  ON salons FOR SELECT USING (true);

CREATE POLICY "salons: insertion par utilisateur authentifié"
  ON salons FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "salons: modification par le manager"
  ON salons FOR UPDATE USING (
    id IN (SELECT salon_id FROM coiffeuses WHERE user_id = auth.uid() AND role = 'manager')
  );

-- ─────────────────────────────────────────────
-- POLICIES RLS — salon_photos
-- ─────────────────────────────────────────────
ALTER TABLE salon_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salon_photos: lecture publique"
  ON salon_photos FOR SELECT USING (true);

CREATE POLICY "salon_photos: gestion par le manager"
  ON salon_photos FOR ALL USING (
    salon_id IN (SELECT salon_id FROM coiffeuses WHERE user_id = auth.uid() AND role = 'manager')
  );

-- ─────────────────────────────────────────────
-- POLICIES RLS — salon_invites
-- ─────────────────────────────────────────────
ALTER TABLE salon_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "salon_invites: lecture par code (tout le monde)"
  ON salon_invites FOR SELECT USING (true);

CREATE POLICY "salon_invites: insertion par le manager"
  ON salon_invites FOR INSERT WITH CHECK (
    salon_id IN (SELECT salon_id FROM coiffeuses WHERE user_id = auth.uid() AND role = 'manager')
    OR auth.uid() IS NOT NULL
  );

CREATE POLICY "salon_invites: modification (marquer utilisé)"
  ON salon_invites FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────
-- POLICIES RLS — services
-- ─────────────────────────────────────────────
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services: lecture publique"
  ON services FOR SELECT USING (true);

CREATE POLICY "services: gestion par le manager"
  ON services FOR ALL USING (
    salon_id IN (SELECT salon_id FROM coiffeuses WHERE user_id = auth.uid() AND role = 'manager')
  );

-- ─────────────────────────────────────────────
-- POLICIES RLS — opening_hours
-- ─────────────────────────────────────────────
ALTER TABLE opening_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "opening_hours: lecture publique"
  ON opening_hours FOR SELECT USING (true);

CREATE POLICY "opening_hours: gestion par le manager"
  ON opening_hours FOR ALL USING (
    salon_id IN (SELECT salon_id FROM coiffeuses WHERE user_id = auth.uid() AND role = 'manager')
  );

-- ─────────────────────────────────────────────
-- POLICIES RLS — clientes
-- ─────────────────────────────────────────────
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clientes: lecture publique"
  ON clientes FOR SELECT USING (true);

CREATE POLICY "clientes: insertion par le propriétaire"
  ON clientes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "clientes: modification par le propriétaire"
  ON clientes FOR UPDATE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- POLICIES RLS — coiffeuses
-- ─────────────────────────────────────────────
ALTER TABLE coiffeuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coiffeuses: lecture publique"
  ON coiffeuses FOR SELECT USING (true);

CREATE POLICY "coiffeuses: insertion par le propriétaire"
  ON coiffeuses FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "coiffeuses: modification par le propriétaire"
  ON coiffeuses FOR UPDATE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- POLICIES RLS — prestations
-- ─────────────────────────────────────────────
ALTER TABLE prestations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prestations: lecture publique"
  ON prestations FOR SELECT USING (true);

CREATE POLICY "prestations: gestion par la coiffeuse"
  ON prestations FOR ALL USING (
    coiffeuse_id IN (SELECT id FROM coiffeuses WHERE user_id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- POLICIES RLS — appointments
-- ─────────────────────────────────────────────
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointments: lecture par les parties concernées"
  ON appointments FOR SELECT USING (
    cliente_id IN (SELECT id FROM clientes WHERE user_id = auth.uid())
    OR coiffeuse_id IN (SELECT id FROM coiffeuses WHERE user_id = auth.uid())
  );

CREATE POLICY "appointments: insertion par la cliente"
  ON appointments FOR INSERT WITH CHECK (
    cliente_id IN (SELECT id FROM clientes WHERE user_id = auth.uid())
  );

CREATE POLICY "appointments: modification par la cliente ou coiffeuse"
  ON appointments FOR UPDATE USING (
    cliente_id IN (SELECT id FROM clientes WHERE user_id = auth.uid())
    OR coiffeuse_id IN (SELECT id FROM coiffeuses WHERE user_id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- POLICIES RLS — book_photos
-- ─────────────────────────────────────────────
ALTER TABLE book_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "book_photos: lecture publique"
  ON book_photos FOR SELECT USING (true);

CREATE POLICY "book_photos: gestion par la coiffeuse"
  ON book_photos FOR ALL USING (
    coiffeuse_id IN (SELECT id FROM coiffeuses WHERE user_id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- POLICIES RLS — avis
-- ─────────────────────────────────────────────
ALTER TABLE avis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avis: lecture publique"
  ON avis FOR SELECT USING (true);

CREATE POLICY "avis: insertion par une cliente authentifiée"
  ON avis FOR INSERT WITH CHECK (
    cliente_id IN (SELECT id FROM clientes WHERE user_id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- POLICIES RLS — photo_partages
-- ─────────────────────────────────────────────
ALTER TABLE photo_partages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photo_partages: lecture publique"
  ON photo_partages FOR SELECT USING (true);

CREATE POLICY "photo_partages: insertion par la cliente"
  ON photo_partages FOR INSERT WITH CHECK (
    cliente_id IN (SELECT id FROM clientes WHERE user_id = auth.uid())
  );

CREATE POLICY "photo_partages: suppression par la cliente"
  ON photo_partages FOR DELETE USING (
    cliente_id IN (SELECT id FROM clientes WHERE user_id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- POLICIES RLS — notifications
-- ─────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications: lecture par le destinataire"
  ON notifications FOR SELECT USING (recipient_user_id = auth.uid());

CREATE POLICY "notifications: insertion service role uniquement"
  ON notifications FOR INSERT WITH CHECK (true);

CREATE POLICY "notifications: marquer comme lu"
  ON notifications FOR UPDATE USING (recipient_user_id = auth.uid());

-- ─────────────────────────────────────────────
-- STORAGE POLICIES
-- ─────────────────────────────────────────────
CREATE POLICY "avatars: lecture publique" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars: upload par utilisateur authentifié" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

CREATE POLICY "book-photos: lecture publique" ON storage.objects
  FOR SELECT USING (bucket_id = 'book-photos');

CREATE POLICY "book-photos: upload par coiffeuse" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'book-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "client-photos: lecture publique" ON storage.objects
  FOR SELECT USING (bucket_id = 'client-photos');

CREATE POLICY "client-photos: upload par cliente" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'client-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Photos: lecture publique" ON storage.objects
  FOR SELECT USING (bucket_id = 'Photos');

CREATE POLICY "Photos: upload par utilisateur authentifié" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'Photos' AND auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────
-- TRIGGER : créer le profil après signup
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'role' = 'coiffeuse' THEN
    INSERT INTO public.coiffeuses (user_id, name, role)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'Coiffeuse'), 'coiffeuse')
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    INSERT INTO public.clientes (user_id, name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'Cliente'))
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────
-- INDEX pour les performances
-- ─────────────────────────────────────────────
CREATE INDEX idx_coiffeuses_salon ON coiffeuses (salon_id);
CREATE INDEX idx_coiffeuses_specialites ON coiffeuses USING GIN (specialites);
CREATE INDEX idx_coiffeuses_ville ON coiffeuses (ville);
CREATE INDEX idx_salon_invites_code ON salon_invites (code) WHERE is_used = false;
CREATE INDEX idx_services_salon ON services (salon_id) WHERE is_active = true;
CREATE INDEX idx_appointments_coiffeuse ON appointments (coiffeuse_id, date_debut);
CREATE INDEX idx_appointments_cliente ON appointments (cliente_id, date_debut);
CREATE INDEX idx_book_photos_coiffeuse ON book_photos (coiffeuse_id, created_at DESC);
CREATE INDEX idx_avis_coiffeuse ON avis (coiffeuse_id, created_at DESC);
CREATE INDEX idx_notifications_recipient ON notifications (recipient_user_id, read, created_at DESC);
