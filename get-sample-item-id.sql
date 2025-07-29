-- Get a sample item ID for testing
SELECT 
    id,
    title,
    lat,
    lon,
    slug
FROM items 
WHERE lat IS NOT NULL AND lon IS NOT NULL 
LIMIT 1; 