-- =====================================================
-- ADD ORIGINAL_NAME TO SEARCH FUNCTIONALITY
-- =====================================================

-- This script adds original_name and caption to the search functionality
-- so users can search by the original filename and image captions

-- 1. First, let's check if the tsv column exists and update it
-- If tsv is a generated column, we need to drop and recreate it

-- Drop the existing tsv column if it exists
ALTER TABLE items DROP COLUMN IF EXISTS tsv;

-- Add the tsv column with original_name and caption included
-- Note: caption field exists but is usually NULL, which is fine with COALESCE
ALTER TABLE items ADD COLUMN tsv tsvector 
GENERATED ALWAYS AS (
  to_tsvector('german', 
    COALESCE(title, '') || ' ' || 
    COALESCE(description, '') || ' ' || 
    COALESCE(original_name, '') || ' ' ||
    COALESCE(caption, '')
  )
) STORED;

-- Create GIN index for the tsv column
CREATE INDEX IF NOT EXISTS idx_items_tsv ON items USING gin(tsv);

-- Create a separate index for keywords since they're an array
CREATE INDEX IF NOT EXISTS idx_items_keywords ON items USING gin(keywords);

-- 2. The existing search function will work as-is since it uses i.tsv
-- The tsv column now includes original_name and caption, so the search will work automatically

-- 3. Test the search functionality
-- Test with a sample search using the existing function
SELECT title, original_name, slug 
FROM gallery_items_search_postgis(0, 0, 0, 5, NULL, 'test')
LIMIT 5;

-- 4. Show the current tsv content for verification
SELECT title, original_name, caption, tsv 
FROM items 
WHERE (original_name IS NOT NULL OR caption IS NOT NULL)
LIMIT 3;
