-- ============================================================
-- FreshGirlz — Migration : Profil salon V2
-- Zone d'intervention + TikTok
-- Colle ce SQL dans Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- Zone d'intervention sur coiffeuses (paramètre individuel)
ALTER TABLE coiffeuses ADD COLUMN IF NOT EXISTS intervention_zone text;

-- TikTok sur salons
ALTER TABLE salons ADD COLUMN IF NOT EXISTS tiktok text;

-- Zone d'intervention sur salons (si le salon a une zone globale)
ALTER TABLE salons ADD COLUMN IF NOT EXISTS intervention_zone text;
