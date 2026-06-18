-- Warenkorb für Bildlizenzen + Fix: mehrere Lizenzen pro Lemon-Bestellung

BEGIN;

-- Mehrere Bilder pro Bestellung erlauben
ALTER TABLE public.license_purchases
  DROP CONSTRAINT IF EXISTS license_purchases_lemon_order_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'license_purchases_order_item_tier_key'
  ) THEN
    ALTER TABLE public.license_purchases
      ADD CONSTRAINT license_purchases_order_item_tier_key
      UNIQUE (lemon_order_id, item_id, license_tier);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.license_cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  license_tier VARCHAR(32) NOT NULL CHECK (license_tier IN ('standard', 'extended')),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 100),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_license_cart_items_user ON public.license_cart_items(user_id, added_at DESC);

ALTER TABLE public.license_cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own cart" ON public.license_cart_items;
CREATE POLICY "Users manage own cart" ON public.license_cart_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.license_cart_items TO authenticated;

COMMIT;
