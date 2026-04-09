-- =============================================================================
-- Öffentliches Profil für die Item-„Ersteller“-Box (SSR + API)
-- =============================================================================
-- SECURITY DEFINER: liest nur freigegebene Spalten und umgeht RLS auf
-- public.profiles (z. B. nach Aktivierung von RLS ohne breite SELECT-Policy).
--
-- Spalten: öffentliche Felder für die Ersteller-Box (kein vollständiges Abbild von
-- ITEM_PAGE_PROFILE_SELECT in TS — dort kann „bio“/„show_bio“ per Fallback geladen werden).
-- Hinweis: In manchen DBs fehlen bio/show_bio; die RPC listet sie daher nicht.
-- Optional nachziehen: ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;
--   ADD COLUMN IF NOT EXISTS show_bio boolean;
--
-- Attribution-Spalten: siehe 2026-03-25_add-profile-attribution-fields.sql
--
-- In Supabase SQL Editor ausführen (oder psql).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_public_profile_for_item_page(p_profile_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(p)
  FROM (
    SELECT
      id,
      full_name,
      accountname,
      avatar_url,
      address,
      show_address,
      phone,
      show_phone,
      email,
      show_email,
      website,
      show_website,
      instagram,
      facebook,
      twitter,
      show_social,
      privacy_mode,
      display_name_public,
      legal_entity_name,
      copyright_holder_name,
      default_creator_name,
      default_credit_text,
      default_copyright_notice,
      default_license_url,
      default_author_meta,
      organization_name,
      use_exif_creator_override,
      use_exif_credit_override,
      use_exif_copyright_override,
      photographer_label_mode,
      public_contact_name
    FROM public.profiles
    WHERE id = p_profile_id
    LIMIT 1
  ) p;
$$;

REVOKE ALL ON FUNCTION public.get_public_profile_for_item_page(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile_for_item_page(uuid) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_public_profile_for_item_page(uuid) IS
  'Item-Seite: öffentliche Profilfelder für Ersteller-Box; umgeht RLS. App: fetchItemPageProfile.ts';
