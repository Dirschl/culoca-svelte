-- Culoca Bildlizenzen via Lemon Squeezy (Merchant of Record)
-- Nach Kauf: Download-Rechte über get_unified_item_rights

BEGIN;

CREATE TABLE IF NOT EXISTS public.license_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  seller_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  license_tier VARCHAR(32) NOT NULL CHECK (license_tier IN ('standard', 'extended')),
  status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'refunded', 'revoked')),
  lemon_order_id TEXT NOT NULL,
  lemon_order_number TEXT,
  lemon_variant_id TEXT,
  lemon_customer_id TEXT,
  lemon_license_key_id TEXT,
  price_cents INTEGER,
  currency VARCHAR(8),
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  refunded_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (lemon_order_id),
  UNIQUE (buyer_user_id, item_id, license_tier, lemon_order_id)
);

CREATE INDEX IF NOT EXISTS idx_license_purchases_buyer ON public.license_purchases(buyer_user_id, purchased_at DESC);
CREATE INDEX IF NOT EXISTS idx_license_purchases_item ON public.license_purchases(item_id);
CREATE INDEX IF NOT EXISTS idx_license_purchases_active ON public.license_purchases(buyer_user_id, item_id)
  WHERE status = 'active';

ALTER TABLE public.license_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Buyers can view own licenses" ON public.license_purchases;
CREATE POLICY "Buyers can view own licenses" ON public.license_purchases
  FOR SELECT USING (auth.uid() = buyer_user_id);

DROP POLICY IF EXISTS "Sellers can view licenses for their items" ON public.license_purchases;
CREATE POLICY "Sellers can view licenses for their items" ON public.license_purchases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.items i
      WHERE i.id = license_purchases.item_id AND i.profile_id = auth.uid()
    )
  );

GRANT SELECT ON public.license_purchases TO authenticated;

-- Erweitert get_unified_item_rights um aktive Käufe
CREATE OR REPLACE FUNCTION public.get_unified_item_rights(
  p_item_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  item_owner_id UUID;
  profile_rights JSONB;
  item_rights JSONB;
  role_permissions JSONB;
  result JSONB;
  has_license BOOLEAN;
BEGIN
  SELECT profile_id INTO item_owner_id FROM public.items WHERE id = p_item_id;

  IF item_owner_id = p_user_id THEN
    RETURN '{"download": true, "download_original": true, "edit": true, "delete": true}'::JSONB;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.license_purchases lp
    WHERE lp.item_id = p_item_id
      AND lp.buyer_user_id = p_user_id
      AND lp.status = 'active'
  ) INTO has_license;

  IF has_license THEN
    RETURN '{"download": true, "download_original": true, "edit": false, "delete": false, "licensed": true}'::JSONB;
  END IF;

  SELECT rights INTO profile_rights
  FROM public.profile_rights
  WHERE profile_id = item_owner_id AND target_user_id = p_user_id;

  SELECT rights INTO item_rights
  FROM public.item_rights
  WHERE item_id = p_item_id AND target_user_id = p_user_id;

  SELECT permissions INTO role_permissions
  FROM public.roles r
  JOIN public.profiles p ON p.role_id = r.id
  WHERE p.id = p_user_id;

  result := jsonb_build_object(
    'download', COALESCE(role_permissions->>'download', 'false')::BOOLEAN,
    'download_original', COALESCE(role_permissions->>'download_original', 'false')::BOOLEAN,
    'edit', COALESCE(role_permissions->>'edit', 'false')::BOOLEAN,
    'delete', COALESCE(role_permissions->>'delete', 'false')::BOOLEAN,
    'licensed', false
  );

  IF profile_rights IS NOT NULL THEN
    result := jsonb_build_object(
      'download', COALESCE(profile_rights->>'download', result->>'download')::BOOLEAN,
      'download_original', COALESCE(profile_rights->>'download_original', result->>'download_original')::BOOLEAN,
      'edit', COALESCE(profile_rights->>'edit', result->>'edit')::BOOLEAN,
      'delete', COALESCE(profile_rights->>'delete', result->>'delete')::BOOLEAN,
      'licensed', COALESCE(result->>'licensed', 'false')::BOOLEAN
    );
  END IF;

  IF item_rights IS NOT NULL THEN
    result := jsonb_build_object(
      'download', COALESCE(item_rights->>'download', result->>'download')::BOOLEAN,
      'download_original', COALESCE(item_rights->>'download_original', result->>'download_original')::BOOLEAN,
      'edit', COALESCE(item_rights->>'edit', result->>'edit')::BOOLEAN,
      'delete', COALESCE(item_rights->>'delete', result->>'delete')::BOOLEAN,
      'licensed', COALESCE(result->>'licensed', 'false')::BOOLEAN
    );
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
