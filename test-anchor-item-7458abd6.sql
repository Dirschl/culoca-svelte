-- Test anchor-based distance calculation for item 7458abd6-478f-4bf0-a227-84c333f467d9
-- This uses the correct sorting logic from yesterday

-- First, get the anchor item's GPS coordinates
WITH anchor_item AS (
  SELECT 
    id,
    lat as anchor_lat,
    lon as anchor_lon
  FROM items 
  WHERE id = '7458abd6-478f-4bf0-a227-84c333f467d9'
)
-- Then get all items sorted by distance from anchor location
SELECT 
    i.id,
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
    i.camera,
    i.lens,
    i.original_name,
    i.exif_data,
    i.created_at,
    i.is_private,
    CASE 
        WHEN i.id = '7458abd6-478f-4bf0-a227-84c333f467d9' THEN 0.0  -- Anchor item gets 0 distance
        WHEN i.lat IS NOT NULL AND i.lon IS NOT NULL AND anchor.anchor_lat IS NOT NULL AND anchor.anchor_lon IS NOT NULL THEN
            6371000 * acos(
                cos(radians(anchor.anchor_lat)) * cos(radians(i.lat)) * 
                cos(radians(i.lon) - radians(anchor.anchor_lon)) + 
                sin(radians(anchor.anchor_lat)) * sin(radians(i.lat))
            )
        ELSE NULL
    END as distance
FROM items i
CROSS JOIN anchor_item anchor
WHERE i.lat IS NOT NULL 
AND i.lon IS NOT NULL
AND anchor.anchor_lat IS NOT NULL 
AND anchor.anchor_lon IS NOT NULL
ORDER BY 
    CASE WHEN i.id = '7458abd6-478f-4bf0-a227-84c333f467d9' THEN 0 ELSE 1 END,  -- Anchor item first
    distance ASC  -- Then by distance
LIMIT 50; 