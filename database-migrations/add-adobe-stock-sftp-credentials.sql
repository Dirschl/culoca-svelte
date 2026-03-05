-- Adobe Stock SFTP credentials per user profile (idempotent)

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS adobe_stock_sftp_host TEXT;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS adobe_stock_sftp_username TEXT;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS adobe_stock_sftp_password TEXT;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS adobe_stock_sftp_remote_dir TEXT;
