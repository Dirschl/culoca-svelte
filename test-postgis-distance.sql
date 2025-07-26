-- Test PostGIS Entfernungsberechnung
-- Teste die einheitliche PostGIS-Funktion mit echten Daten

-- Test mit GPS-Koordinaten
SELECT 
  title,
  lat,
  lon,
  CASE
    WHEN 48.31936293566058 != 0 AND 12.718432453710898 != 0 AND lat IS NOT NULL AND lon IS NOT NULL THEN
      ST_Distance(
        ST_MakePoint(12.718432453710898, 48.31936293566058)::geography,
        ST_MakePoint(lon, lat)::geography
      )
    ELSE
      999999999
  END AS distance
FROM items 
WHERE path_512 IS NOT NULL
  AND gallery = true
  AND (is_private = false OR is_private IS NULL)
  AND (title ILIKE '%burghausen%' OR description ILIKE '%burghausen%')
ORDER BY distance ASC
LIMIT 5;

-- Test der einheitlichen PostGIS-Funktion
SELECT 
  title,
  lat,
  lon,
  distance
FROM gallery_items_unified_postgis(
  48.31936293566058,  -- user_lat
  12.718432453710898, -- user_lon
  0,                  -- page_value
  5,                  -- page_size_value
  NULL,               -- current_user_id
  'burghausen'        -- search_term
); 