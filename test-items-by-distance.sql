-- Test der items_by_distance Funktion für Burghausen (48.31783, 12.71324)
-- Prüft ob die Sortierung nach Distanz korrekt funktioniert

-- 1. Test der items_by_distance Funktion direkt
SELECT 
    'items_by_distance function test' as test_name,
    COUNT(*) as total_items,
    MIN(distance) as min_distance,
    MAX(distance) as max_distance,
    AVG(distance) as avg_distance
FROM items_by_distance(48.31783, 12.71324, 0, 50, NULL, TRUE, NULL);

-- 2. Zeige die ersten 10 Items mit Distanzen
SELECT 
    id,
    title,
    lat,
    lon,
    ROUND(distance) as distance_meters,
    created_at
FROM items_by_distance(48.31783, 12.71324, 0, 10, NULL, TRUE, NULL)
ORDER BY distance ASC;

-- 3. Prüfe ob die Sortierung korrekt ist (sollte bereits sortiert sein)
WITH test_results AS (
    SELECT 
        id,
        title,
        distance,
        ROW_NUMBER() OVER (ORDER BY distance ASC) as expected_rank,
        ROW_NUMBER() OVER () as actual_rank
    FROM items_by_distance(48.31783, 12.71324, 0, 20, NULL, TRUE, NULL)
)
SELECT 
    'Sorting check' as check_type,
    COUNT(*) as total_items,
    SUM(CASE WHEN expected_rank = actual_rank THEN 1 ELSE 0 END) as correctly_sorted,
    SUM(CASE WHEN expected_rank != actual_rank THEN 1 ELSE 0 END) as incorrectly_sorted
FROM test_results;

-- 4. Vergleiche mit manueller SQL-Abfrage
SELECT 
    'Manual SQL vs items_by_distance' as comparison,
    COUNT(*) as manual_count
FROM (
    SELECT 
        i.id,
        i.title,
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
        AND (i.is_private = false OR i.is_private IS NULL)
        AND i.gallery = true
    ORDER BY distance_meters ASC NULLS LAST
    LIMIT 10
) as manual_query;

-- 5. Debug: Zeige alle verfügbaren items_by_distance Funktionen
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name LIKE 'items_by_distance%'
ORDER BY routine_name;

-- 6. Test mit verschiedenen Parametern
SELECT 
    'Test with different parameters' as test_name,
    COUNT(*) as result_count
FROM items_by_distance(48.31783, 12.71324, 0, 5, NULL, FALSE, NULL);

-- 7. Prüfe ob die Funktion die richtigen Spalten zurückgibt
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'items_by_distance'
ORDER BY ordinal_position; 