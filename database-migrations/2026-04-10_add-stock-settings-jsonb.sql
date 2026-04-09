-- =============================================================================
-- Stock-Metadaten pro Item (flexibles JSON)
-- =============================================================================
-- Start: agencies.adobe — synchron zu den Legacy-Spalten adobe_stock_*.
-- App: src/lib/stock/itemStockSettings.ts
-- =============================================================================

BEGIN;

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS stock_settings jsonb;

UPDATE public.items
SET stock_settings = '{}'::jsonb
WHERE stock_settings IS NULL;

ALTER TABLE public.items
  ALTER COLUMN stock_settings SET DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'items_stock_settings_is_object'
  ) THEN
    ALTER TABLE public.items
      ADD CONSTRAINT items_stock_settings_is_object
      CHECK (stock_settings IS NULL OR jsonb_typeof(stock_settings) = 'object');
  END IF;
END $$;

-- Initiale Synchronisation: agencies.adobe aus Legacy-Spalten
UPDATE public.items
SET stock_settings = jsonb_set(
  COALESCE(stock_settings, '{}'::jsonb),
  '{agencies,adobe}',
  jsonb_strip_nulls(
    jsonb_build_object(
      'status', to_jsonb(COALESCE(adobe_stock_status, 'none')),
      'uploadedAt', to_jsonb(adobe_stock_uploaded_at),
      'assetId', to_jsonb(adobe_stock_asset_id),
      'publicUrl', to_jsonb(adobe_stock_url),
      'error', to_jsonb(adobe_stock_error)
    )
  ),
  true
);

COMMIT;
