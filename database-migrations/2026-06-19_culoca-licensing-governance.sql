-- Culoca Bildverkauf: Ersteller-Opt-in + Kurator-Freigabe pro Bild
-- Standard: keine Lizenzierung bis Ersteller zustimmt und Kurator freigibt.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS culoca_licensing_opt_in BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS culoca_licensing_opt_in_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.culoca_licensing_opt_in IS
  'Ersteller erlaubt Culoca, seine Fotos nach Einzelfreigabe kommerziell zu lizenzieren.';

-- DIRSCHL-Kurator: implizite Zustimmung
UPDATE public.profiles
SET
  culoca_licensing_opt_in = true,
  culoca_licensing_opt_in_at = COALESCE(culoca_licensing_opt_in_at, NOW())
WHERE id = '0ceb2320-0553-463b-971a-a0eef5ecdf09';
