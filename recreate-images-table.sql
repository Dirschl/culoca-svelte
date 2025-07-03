-- Recreate images table with all necessary columns and RLS rules
-- This script will drop the existing table and recreate it from scratch

-- Drop existing table if it exists
DROP TABLE IF EXISTS images CASCADE;

-- Create images table
CREATE TABLE images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    path_512 TEXT NOT NULL,
    path_2048 TEXT,
    width INTEGER,
    height INTEGER,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    title TEXT,
    description TEXT,
    keywords TEXT[],
    camera TEXT,
    lens TEXT,
    original_name TEXT,
    exif_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_images_created_at ON images(created_at DESC);
CREATE INDEX idx_images_profile_id ON images(profile_id);
CREATE INDEX idx_images_user_id ON images(user_id);
CREATE INDEX idx_images_location ON images(lat, lon) WHERE lat IS NOT NULL AND lon IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE images ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow users to see all images (public gallery)
CREATE POLICY "Allow public read access" ON images
    FOR SELECT USING (true);

-- Allow authenticated users to insert their own images
CREATE POLICY "Allow authenticated users to insert" ON images
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own images
CREATE POLICY "Allow users to update own images" ON images
    FOR UPDATE USING (auth.uid() = user_id);

-- Allow users to delete their own images
CREATE POLICY "Allow users to delete own images" ON images
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
CREATE TRIGGER update_images_updated_at 
    BEFORE UPDATE ON images 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function for distance-based image queries
CREATE OR REPLACE FUNCTION images_by_distance(
    user_lat DOUBLE PRECISION,
    user_lon DOUBLE PRECISION,
    page INTEGER DEFAULT 0,
    page_size INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    profile_id UUID,
    user_id UUID,
    path_512 TEXT,
    path_2048 TEXT,
    width INTEGER,
    height INTEGER,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    title TEXT,
    description TEXT,
    keywords TEXT[],
    camera TEXT,
    lens TEXT,
    original_name TEXT,
    exif_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    distance DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.*,
        CASE 
            WHEN i.lat IS NOT NULL AND i.lon IS NOT NULL THEN
                6371000 * acos(
                    cos(radians(user_lat)) * cos(radians(i.lat)) * 
                    cos(radians(i.lon) - radians(user_lon)) + 
                    sin(radians(user_lat)) * sin(radians(i.lat))
                )
            ELSE NULL
        END as distance
    FROM images i
    ORDER BY 
        CASE 
            WHEN i.lat IS NOT NULL AND i.lon IS NOT NULL THEN
                6371000 * acos(
                    cos(radians(user_lat)) * cos(radians(i.lat)) * 
                    cos(radians(i.lon) - radians(user_lon)) + 
                    sin(radians(user_lat)) * sin(radians(i.lat))
                )
        END ASC NULLS LAST,
        i.created_at DESC
    LIMIT page_size OFFSET (page * page_size);
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT ALL ON images TO authenticated;
GRANT SELECT ON images TO anon;
GRANT EXECUTE ON FUNCTION images_by_distance TO authenticated;
GRANT EXECUTE ON FUNCTION images_by_distance TO anon;

-- Insert some test data (optional)
-- INSERT INTO images (id, profile_id, user_id, path_512, path_2048, width, height, original_name, created_at)
-- VALUES 
--     ('12345678-1234-1234-1234-123456789abc', NULL, NULL, 'test1.jpg', 'test1.jpg', 1920, 1080, 'Test Image 1', NOW()),
--     ('87654321-4321-4321-4321-cba987654321', NULL, NULL, 'test2.jpg', 'test2.jpg', 1920, 1080, 'Test Image 2', NOW());

COMMENT ON TABLE images IS 'Stores image metadata and file paths';
COMMENT ON COLUMN images.profile_id IS 'Creator profile ID (nullable for anonymous uploads)';
COMMENT ON COLUMN images.user_id IS 'Creator user ID from auth.users';
COMMENT ON COLUMN images.path_512 IS 'Path to 512px thumbnail in storage';
COMMENT ON COLUMN images.path_2048 IS 'Path to 2048px version in storage';
COMMENT ON COLUMN images.exif_data IS 'JSON object containing EXIF metadata'; 