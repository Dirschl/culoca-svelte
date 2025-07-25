-- Test SQL Query für Burghausen (48.31783, 12.71324)
-- Mit Batch-Loading, RLS-Limits, Slug und Query-String-Suche

-- Parameter für Burghausen
-- user_lat = 48.31783
-- user_lon = 12.71324

-- 1. EINFACHE VERSION (ohne Batch-Loading) - für Tests
-- Diese Version hat RLS-Limits (1000 Items max)
SELECT 
    i.id,
    i.slug,  -- ← Slug hinzugefügt
    i.profile_id,
    i.user_id,
    i.path_512,
    i.path_2048,
    i.path_64,
    i.width,
    i.height,
    i.lat,
    i.lon,
    i.title,
    i.description,
    i.keywords,
    i.original_name,
    i.exif_data,
    i.created_at,
    i.is_private,
    i.gallery,
    -- Haversine Distanz-Berechnung
    CASE 
        WHEN i.lat IS NOT NULL AND i.lon IS NOT NULL THEN
            6371000 * acos(
                cos(radians(48.31783)) * cos(radians(i.lat)) * 
                cos(radians(i.lon) - radians(12.71324)) + 
                sin(radians(48.31783)) * sin(radians(i.lat))
            )
        ELSE NULL
    END as distance_meters
FROM items i
WHERE 
    i.lat IS NOT NULL 
    AND i.lon IS NOT NULL 
    AND i.path_512 IS NOT NULL
    AND i.slug IS NOT NULL  -- ← Slug-Filter
    -- Nur öffentliche Items
    AND (i.is_private = false OR i.is_private IS NULL)
    -- Gallery-Filter
    AND i.gallery = true
    -- Query-String-Suche (optional)
    -- AND (i.title ILIKE '%burghausen%' OR i.description ILIKE '%burghausen%' OR (i.keywords IS NOT NULL AND i.keywords && ARRAY['burghausen']))
ORDER BY 
    distance_meters ASC NULLS LAST,
    i.created_at DESC
LIMIT 1000;  -- RLS-Limit

-- 2. BATCH-LOADING VERSION (wie in der aktuellen Nearby-Galerie)
-- Diese Version umgeht RLS-Limits durch Batch-Loading

-- Batch 1: Offset 0-999
SELECT 
    i.id,
    i.slug,
    i.profile_id,
    i.user_id,
    i.path_512,
    i.path_2048,
    i.path_64,
    i.width,
    i.height,
    i.lat,
    i.lon,
    i.title,
    i.description,
    i.keywords,
    i.original_name,
    i.exif_data,
    i.created_at,
    i.is_private,
    i.gallery,
    CASE 
        WHEN i.lat IS NOT NULL AND i.lon IS NOT NULL THEN
            6371000 * acos(
                cos(radians(48.31783)) * cos(radians(i.lat)) * 
                cos(radians(i.lon) - radians(12.71324)) + 
                sin(radians(48.31783)) * sin(radians(i.lat))
            )
        ELSE NULL
    END as distance_meters
FROM items i
WHERE 
    i.lat IS NOT NULL 
    AND i.lon IS NOT NULL 
    AND i.path_512 IS NOT NULL
    AND i.slug IS NOT NULL
    AND (i.is_private = false OR i.is_private IS NULL)
    AND i.gallery = true
    -- Geografische Bounding Box für Performance
    AND i.lat BETWEEN 48.27283 AND 48.36283  -- ±0.045 Grad (≈5km)
    AND i.lon BETWEEN 12.66824 AND 12.75824
ORDER BY i.created_at DESC
LIMIT 1000 OFFSET 0;

-- Batch 2: Offset 1000-1999
-- SELECT ... FROM items i WHERE ... LIMIT 1000 OFFSET 1000;

-- Batch 3: Offset 2000-2999
-- SELECT ... FROM items i WHERE ... LIMIT 1000 OFFSET 2000;

-- 3. VOLLSTÄNDIGE BATCH-LOADING LÖSUNG (wie in +page.server.ts)
-- Diese Version kombiniert alle Batches und sortiert client-seitig

-- Batch-Loading mit CTE (Common Table Expression)
WITH all_batches AS (
    -- Batch 1
    SELECT 
        i.id,
        i.slug,
        i.profile_id,
        i.user_id,
        i.path_512,
        i.path_2048,
        i.path_64,
        i.width,
        i.height,
        i.lat,
        i.lon,
        i.title,
        i.description,
        i.keywords,
        i.original_name,
        i.exif_data,
        i.created_at,
        i.is_private,
        i.gallery
    FROM items i
    WHERE 
        i.lat IS NOT NULL 
        AND i.lon IS NOT NULL 
        AND i.path_512 IS NOT NULL
        AND i.slug IS NOT NULL
        AND (i.is_private = false OR i.is_private IS NULL)
        AND i.gallery = true
        -- Bounding Box für Performance
        AND i.lat BETWEEN 48.27283 AND 48.36283
        AND i.lon BETWEEN 12.66824 AND 12.75824
    ORDER BY i.created_at DESC
    LIMIT 1000 OFFSET 0
    
    UNION ALL
    
    -- Batch 2 (falls mehr Daten vorhanden)
    SELECT 
        i.id,
        i.slug,
        i.profile_id,
        i.user_id,
        i.path_512,
        i.path_2048,
        i.path_64,
        i.width,
        i.height,
        i.lat,
        i.lon,
        i.title,
        i.description,
        i.keywords,
        i.original_name,
        i.exif_data,
        i.created_at,
        i.is_private,
        i.gallery
    FROM items i
    WHERE 
        i.lat IS NOT NULL 
        AND i.lon IS NOT NULL 
        AND i.path_512 IS NOT NULL
        AND i.slug IS NOT NULL
        AND (i.is_private = false OR i.is_private IS NULL)
        AND i.gallery = true
        AND i.lat BETWEEN 48.27283 AND 48.36283
        AND i.lon BETWEEN 12.66824 AND 12.75824
    ORDER BY i.created_at DESC
    LIMIT 1000 OFFSET 1000
    
    UNION ALL
    
    -- Batch 3 (falls noch mehr Daten vorhanden)
    SELECT 
        i.id,
        i.slug,
        i.profile_id,
        i.user_id,
        i.path_512,
        i.path_2048,
        i.path_64,
        i.width,
        i.height,
        i.lat,
        i.lon,
        i.title,
        i.description,
        i.keywords,
        i.original_name,
        i.exif_data,
        i.created_at,
        i.is_private,
        i.gallery
    FROM items i
    WHERE 
        i.lat IS NOT NULL 
        AND i.lon IS NOT NULL 
        AND i.path_512 IS NOT NULL
        AND i.slug IS NOT NULL
        AND (i.is_private = false OR i.is_private IS NULL)
        AND i.gallery = true
        AND i.lat BETWEEN 48.27283 AND 48.36283
        AND i.lon BETWEEN 12.66824 AND 12.75824
    ORDER BY i.created_at DESC
    LIMIT 1000 OFFSET 2000
),
items_with_distance AS (
    SELECT 
        *,
        CASE 
            WHEN lat IS NOT NULL AND lon IS NOT NULL THEN
                6371000 * acos(
                    cos(radians(48.31783)) * cos(radians(lat)) * 
                    cos(radians(lon) - radians(12.71324)) + 
                    sin(radians(48.31783)) * sin(radians(lat))
                )
            ELSE NULL
        END as distance_meters
    FROM all_batches
)
SELECT * FROM items_with_distance
WHERE distance_meters <= 5000  -- 5km Radius
ORDER BY distance_meters ASC, created_at DESC
LIMIT 50;

-- 4. ALTERNATIVE: items_by_distance FUNKTION VERWENDEN
-- Das wäre die sauberste Lösung, aber erfordert Service Role

-- SELECT * FROM items_by_distance(48.31783, 12.71324, 0, 50, NULL, TRUE, NULL);

-- 5. DEBUG: ZEIGE ANZAHL DER ITEMS IN BURGHAUSEN-UMGEBUNG
SELECT 
    'Total items in Burghausen area' as info,
    COUNT(*) as count
FROM items i
WHERE 
    i.lat IS NOT NULL 
    AND i.lon IS NOT NULL 
    AND i.path_512 IS NOT NULL
    AND i.slug IS NOT NULL
    AND (i.is_private = false OR i.is_private IS NULL)
    AND i.gallery = true
    AND i.lat BETWEEN 48.27283 AND 48.36283
    AND i.lon BETWEEN 12.66824 AND 12.75824;

-- 6. DEBUG: ZEIGE DISTANZ-VERTEILUNG
SELECT 
    'Distance distribution' as info,
    CASE 
        WHEN distance_meters <= 1000 THEN '0-1km'
        WHEN distance_meters <= 2000 THEN '1-2km'
        WHEN distance_meters <= 3000 THEN '2-3km'
        WHEN distance_meters <= 4000 THEN '3-4km'
        WHEN distance_meters <= 5000 THEN '4-5km'
        ELSE '>5km'
    END as distance_range,
    COUNT(*) as count
FROM (
    SELECT 
        CASE 
            WHEN i.lat IS NOT NULL AND i.lon IS NOT NULL THEN
                6371000 * acos(
                    cos(radians(48.31783)) * cos(radians(i.lat)) * 
                    cos(radians(i.lon) - radians(12.71324)) + 
                    sin(radians(48.31783)) * sin(radians(i.lat))
                )
            ELSE NULL
        END as distance_meters
    FROM items i
    WHERE 
        i.lat IS NOT NULL 
        AND i.lon IS NOT NULL 
        AND i.path_512 IS NOT NULL
        AND i.slug IS NOT NULL
        AND (i.is_private = false OR i.is_private IS NULL)
        AND i.gallery = true
        AND i.lat BETWEEN 48.27283 AND 48.36283
        AND i.lon BETWEEN 12.66824 AND 12.75824
) as distances
GROUP BY distance_range
ORDER BY distance_range; 