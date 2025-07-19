-- Create items_search_view for efficient text search
-- This view combines title, description, and keywords into a searchable text field

CREATE OR REPLACE VIEW items_search_view AS
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
    i.gallery,
    -- Combine all searchable text into one field
    LOWER(
        COALESCE(i.title, '') || ' ' ||
        COALESCE(i.description, '') || ' ' ||
        COALESCE(
            CASE 
                WHEN i.keywords IS NULL THEN ''
                WHEN i.keywords = '{}' THEN ''
                ELSE array_to_string(i.keywords, ' ')
            END, ''
        )
    ) as searchtext
FROM items i
WHERE i.path_512 IS NOT NULL; -- Only include items with processed images

-- Grant necessary permissions
GRANT SELECT ON items_search_view TO authenticated;
GRANT SELECT ON items_search_view TO anon;

-- Create index for better search performance
CREATE INDEX IF NOT EXISTS idx_items_search_view_searchtext ON items_search_view USING gin(to_tsvector('german', searchtext));
CREATE INDEX IF NOT EXISTS idx_items_search_view_gallery ON items_search_view(gallery);
CREATE INDEX IF NOT EXISTS idx_items_search_view_is_private ON items_search_view(is_private);
CREATE INDEX IF NOT EXISTS idx_items_search_view_user_id ON items_search_view(user_id); 