-- Supabase Datenbank zurücksetzen
-- Führen Sie dieses Script im Supabase SQL Editor aus

-- 1. Alle Tabellen löschen
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS welcome_content CASCADE;

-- 2. Alle Funktionen löschen
DROP FUNCTION IF EXISTS gallery_items_normal_postgis CASCADE;
DROP FUNCTION IF EXISTS gallery_items_search_postgis CASCADE;
DROP FUNCTION IF EXISTS gallery_items_unified_postgis CASCADE;

-- 3. Alle Views löschen
DROP VIEW IF EXISTS gallery_items_normal CASCADE;
DROP VIEW IF EXISTS gallery_items_search CASCADE;

-- 4. PostGIS Extension prüfen
CREATE EXTENSION IF NOT EXISTS postgis;

-- 5. Tabellen neu erstellen
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE,
  title CHARACTER VARYING(255),
  description CHARACTER VARYING(255),
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  path_512 TEXT,
  path_2048 TEXT,
  path_64 TEXT,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  profile_id UUID REFERENCES profiles(id),
  user_id UUID,
  is_private BOOLEAN DEFAULT false,
  gallery BOOLEAN DEFAULT true,
  keywords TEXT[],
  original_name TEXT
);

CREATE TABLE welcome_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Funktionsfähige PostGIS-Funktion erstellen
CREATE OR REPLACE FUNCTION gallery_items_normal_postgis(
  user_lat DOUBLE PRECISION DEFAULT 0,
  user_lon DOUBLE PRECISION DEFAULT 0,
  page_value INTEGER DEFAULT 0,
  page_size_value INTEGER DEFAULT 50,
  current_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  title TEXT,
  description TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  path_512 TEXT,
  path_2048 TEXT,
  path_64 TEXT,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  profile_id UUID,
  user_id UUID,
  is_private BOOLEAN,
  gallery BOOLEAN,
  keywords TEXT[],
  original_name TEXT,
  distance DOUBLE PRECISION,
  total_count BIGINT
)
AS $$
BEGIN
  RETURN QUERY
  WITH items_with_distance AS (
    SELECT
      i.*,
      CASE
        WHEN user_lat != 0 AND user_lon != 0 AND i.lat IS NOT NULL AND i.lon IS NOT NULL THEN
          ST_Distance(
            ST_MakePoint(user_lon, user_lat)::geography,
            ST_MakePoint(i.lon, i.lat)::geography
          )
        ELSE
          999999999
      END AS distance,
      COUNT(*) OVER() AS total_count
    FROM items i
    WHERE i.path_512 IS NOT NULL
      AND i.gallery = true
      AND (
        (current_user_id IS NOT NULL AND (i.profile_id = current_user_id OR i.is_private = false OR i.is_private IS NULL))
        OR
        (current_user_id IS NULL AND (i.is_private = false OR i.is_private IS NULL))
      )
  )
  SELECT
    id,
    slug,
    title,
    description,
    lat,
    lon,
    path_512,
    path_2048,
    path_64,
    width,
    height,
    created_at,
    profile_id,
    user_id,
    is_private,
    gallery,
    keywords,
    original_name,
    distance,
    total_count
  FROM items_with_distance
  ORDER BY distance ASC
  OFFSET (page_value * page_size_value)
  LIMIT page_size_value;
END;
$$ LANGUAGE plpgsql;

-- 7. RLS (Row Level Security) aktivieren
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 8. Policies erstellen
CREATE POLICY "Public items are viewable by everyone" ON items
  FOR SELECT USING (is_private = false OR is_private IS NULL);

CREATE POLICY "Users can view their own private items" ON items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own items" ON items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own items" ON items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own items" ON items
  FOR DELETE USING (auth.uid() = user_id);

-- 9. Indexe erstellen für Performance
CREATE INDEX IF NOT EXISTS idx_items_gallery ON items(gallery);
CREATE INDEX IF NOT EXISTS idx_items_path_512 ON items(path_512);
CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_lat_lon ON items(lat, lon);

-- 10. Test-Daten einfügen (optional)
INSERT INTO profiles (full_name) VALUES ('Test User');
INSERT INTO welcome_content (title, content) VALUES ('Willkommen', 'Willkommen bei Culoca!');

SELECT 'Database reset completed successfully!' as status; 