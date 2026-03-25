-- Attribution-Felder für einheitliche Creator-/Copyright-Ausgabe (Google Bilder / Meta / JSON-LD)
-- Hinweis: Alle neuen Felder sind optional (nullable) für Rückwärtskompatibilität.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name_public text,
  ADD COLUMN IF NOT EXISTS legal_entity_name text,
  ADD COLUMN IF NOT EXISTS copyright_holder_name text,
  ADD COLUMN IF NOT EXISTS default_creator_name text,
  ADD COLUMN IF NOT EXISTS default_credit_text text,
  ADD COLUMN IF NOT EXISTS default_copyright_notice text,
  ADD COLUMN IF NOT EXISTS default_license_url text,
  ADD COLUMN IF NOT EXISTS default_author_meta text,
  ADD COLUMN IF NOT EXISTS organization_name text,
  ADD COLUMN IF NOT EXISTS use_exif_creator_override boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS use_exif_credit_override boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS use_exif_copyright_override boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS photographer_label_mode text,
  ADD COLUMN IF NOT EXISTS public_contact_name text;

