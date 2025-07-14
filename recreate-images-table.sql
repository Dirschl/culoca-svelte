-- Recreate items table with proper structure
-- This script drops and recreates the items table

-- Drop existing table if it exists
DROP TABLE IF EXISTS items CASCADE;

-- Create items table
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id),
    user_id UUID REFERENCES auth.users(id),
    original_name TEXT NOT NULL,
    title TEXT,
    description TEXT,
    keywords TEXT[],
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    width INTEGER,
    height INTEGER,
    path_512 TEXT,
    path_2048 TEXT,
    path_64 TEXT,
    image_format TEXT DEFAULT 'jpg',
    exif_data JSONB,
    is_private BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_items_profile_id ON items(profile_id);
CREATE INDEX idx_items_user_id ON items(user_id);
CREATE INDEX idx_items_created_at ON items(created_at DESC);
CREATE INDEX idx_items_lat_lon ON items(lat, lon);
CREATE INDEX idx_items_path_512 ON items(path_512);
CREATE INDEX idx_items_is_private ON items(is_private);

-- Enable Row Level Security
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Policy for public read access (only non-private items)
CREATE POLICY "Public can view non-private items" ON items
    FOR SELECT USING (is_private = false);

-- Policy for users to view their own items (including private ones)
CREATE POLICY "Users can view their own items" ON items
    FOR SELECT USING (auth.uid() = user_id);

-- Policy for users to insert their own items
CREATE POLICY "Users can insert their own items" ON items
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy for users to update their own items
CREATE POLICY "Users can update their own items" ON items
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy for users to delete their own items
CREATE POLICY "Users can delete their own items" ON items
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_items_updated_at 
    BEFORE UPDATE ON items 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to get items by distance
CREATE OR REPLACE FUNCTION items_by_distance(
    user_lat DOUBLE PRECISION,
    user_lon DOUBLE PRECISION,
    max_results INTEGER DEFAULT 100
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    path_512 TEXT,
    path_2048 TEXT,
    path_64 TEXT,
    created_at TIMESTAMPTZ,
    profile_id UUID,
    distance_m DOUBLE PRECISION
)
LANGUAGE SQL
AS $$
    SELECT 
        i.id,
        i.title,
        i.description,
        i.lat,
        i.lon,
        i.path_512,
        i.path_2048,
        i.path_64,
        i.created_at,
        i.profile_id,
        (6371000 * acos(cos(radians(user_lat)) * cos(radians(i.lat)) * cos(radians(i.lon) - radians(user_lon)) + sin(radians(user_lat)) * sin(radians(i.lat)))) AS distance_m
    FROM items i
    WHERE 
        i.lat IS NOT NULL 
        AND i.lon IS NOT NULL 
        AND i.path_512 IS NOT NULL
    ORDER BY distance_m ASC
    LIMIT max_results;
$$;

-- Add column comments
COMMENT ON COLUMN items.profile_id IS 'Creator profile ID (nullable for anonymous uploads)';
COMMENT ON COLUMN items.user_id IS 'Creator user ID from auth.users';
COMMENT ON COLUMN items.path_512 IS 'Path to 512px thumbnail in storage';
COMMENT ON COLUMN items.path_2048 IS 'Path to 2048px version in storage';
COMMENT ON COLUMN items.exif_data IS 'JSON object containing EXIF metadata'; 