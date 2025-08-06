-- Add caption field to items table
-- This field is used for JSON-LD metadata and can contain emotional descriptions
-- Ideal length: 80-120 characters, max length: 300 characters

ALTER TABLE items ADD COLUMN IF NOT EXISTS caption TEXT;

-- Add constraint to limit caption to 300 characters
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'check_caption_length' 
    AND table_name = 'items'
  ) THEN
    ALTER TABLE items ADD CONSTRAINT check_caption_length 
      CHECK (caption IS NULL OR LENGTH(caption) <= 300);
  END IF;
END $$;

-- Add index for better performance when searching captions
CREATE INDEX IF NOT EXISTS idx_items_caption ON items(caption);

-- Add caption to the search view if it exists
DO $$
BEGIN
  -- Check if items_search_view exists
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'items_search_view') THEN
    -- Drop and recreate the view to include caption
    DROP VIEW IF EXISTS items_search_view;
    
    CREATE VIEW items_search_view AS
    SELECT 
      id,
      title,
      description,
      caption,
      keywords,
      lat,
      lon,
      path_512,
      path_2048,
      path_64,
      width,
      height,
      created_at,
      user_id,
      profile_id,
      is_private,
      gallery,
      -- Combine title, description, caption, and keywords for full-text search
      COALESCE(title, '') || ' ' || 
      COALESCE(description, '') || ' ' || 
      COALESCE(caption, '') || ' ' || 
      COALESCE(
        CASE 
          WHEN keywords IS NULL THEN ''
          WHEN keywords = '{}' THEN ''
          ELSE array_to_string(keywords, ' ')
        END, ''
      ) AS search_text
    FROM items
    WHERE path_512 IS NOT NULL;

    -- Note: GIN index creation removed due to IMMUTABLE function requirement
    -- The search view will work without the index, just slower for large datasets

    -- Grant permissions
    GRANT SELECT ON items_search_view TO authenticated;
    GRANT SELECT ON items_search_view TO anon;
  END IF;
END $$;

-- Test the new field
SELECT 'Caption field added successfully!' as status;
SELECT COUNT(*) as total_items FROM items;
SELECT COUNT(*) as items_with_caption FROM items WHERE caption IS NOT NULL; 