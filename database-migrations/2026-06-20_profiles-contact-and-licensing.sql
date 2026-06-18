-- Profil-Speichern: fehlende Spalten für Kontakt, Bio und Culoca-Lizenz-Opt-in
-- In Supabase SQL Editor ausführen, falls Profil-Updates mit Schema-Fehlern scheitern.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS show_email boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS show_bio boolean DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS culoca_licensing_opt_in boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS culoca_licensing_opt_in_at timestamptz;

COMMENT ON COLUMN public.profiles.culoca_licensing_opt_in IS
  'Ersteller erlaubt Culoca, seine Fotos nach Einzelfreigabe kommerziell zu lizenzieren.';

-- Culoca-Kurator (DIRSCHL): implizite Zustimmung
UPDATE public.profiles
SET
  culoca_licensing_opt_in = true,
  culoca_licensing_opt_in_at = COALESCE(culoca_licensing_opt_in_at, NOW())
WHERE id = '0ceb2320-0553-463b-971a-a0eef5ecdf09';
