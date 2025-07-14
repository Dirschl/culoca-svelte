-- Add home base GPS coordinates to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS home_lat DECIMAL(10, 8);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS home_lon DECIMAL(10, 8);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS home_updated_at TIMESTAMP WITH TIME ZONE;

-- Add GPS tracking preferences
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gps_tracking_enabled BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gpx_export_enabled BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_data_share_enabled BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gps_email VARCHAR(255); 