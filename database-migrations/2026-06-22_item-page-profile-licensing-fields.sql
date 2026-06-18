-- Item-Seite: Lizenz-Flags im öffentlichen Profil-RPC (für Kauf-UI)
-- Ohne diese Spalten sehen Besucher keine „In den Warenkorb“-Buttons, obwohl der Verkauf serverseitig freigegeben ist.

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
      public_contact_name,
      culoca_licensing_opt_in,
      culoca_licensing_auto_approve
    FROM public.profiles
    WHERE id = p_profile_id
    LIMIT 1
  ) p;
$$;

COMMENT ON FUNCTION public.get_public_profile_for_item_page(uuid) IS
  'Item-Seite: öffentliche Profilfelder inkl. Culoca-Lizenz-Flags; umgeht RLS.';
