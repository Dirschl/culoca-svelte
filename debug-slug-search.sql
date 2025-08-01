-- Debug: Suche nach Items mit ähnlichen Slugs
SELECT 
  id,
  slug,
  title,
  created_at
FROM items 
WHERE slug LIKE '%brucke%' 
   OR slug LIKE '%bruecke%'
   OR slug LIKE '%toging%'
   OR slug LIKE '%toeging%'
   OR slug LIKE '%alte-steinerne%'
ORDER BY created_at DESC
LIMIT 20; 