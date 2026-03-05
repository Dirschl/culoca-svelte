-- Adobe Stock integration fields (idempotent)

-- Profile-level settings
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS adobe_stock_sftp_enabled BOOLEAN DEFAULT FALSE;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS adobe_stock_profile_url TEXT;

-- Item-level Adobe status/link fields
ALTER TABLE items
ADD COLUMN IF NOT EXISTS adobe_stock_status TEXT DEFAULT 'none'
  CHECK (adobe_stock_status IN ('none', 'uploaded', 'pending_review', 'approved', 'rejected', 'error'));

ALTER TABLE items
ADD COLUMN IF NOT EXISTS adobe_stock_uploaded_at TIMESTAMPTZ;

ALTER TABLE items
ADD COLUMN IF NOT EXISTS adobe_stock_asset_id TEXT;

ALTER TABLE items
ADD COLUMN IF NOT EXISTS adobe_stock_url TEXT;

ALTER TABLE items
ADD COLUMN IF NOT EXISTS adobe_stock_error TEXT;
