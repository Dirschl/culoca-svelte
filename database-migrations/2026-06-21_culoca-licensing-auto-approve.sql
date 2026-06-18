-- Autofreigabe eigener Bilder (Rollenrecht + Profil-Option) + Kurator-Freigabe fremder Bilder

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS culoca_licensing_auto_approve BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.culoca_licensing_auto_approve IS
  'Eigene Fotos standardmäßig im Culoca-Shop (nur mit Rollenrecht culoca_license_auto_approve). Einzelopt-out via stock_settings.culoca.saleApproved=false.';

-- Admin-Rolle: Lizenz-Kurator-Funktionen + Autofreigabe-Berechtigung
UPDATE public.roles
SET
  permissions = COALESCE(permissions, '{}'::jsonb) || '{
    "manage_culoca_licensing": true,
    "culoca_license_auto_approve": true
  }'::jsonb,
  updated_at = NOW()
WHERE name = 'admin';
