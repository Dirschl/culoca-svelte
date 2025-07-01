-- Add EXIF fields to images table (if they don't exist)
DO $$ 
BEGIN
    -- Add title column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'images' AND column_name = 'title') THEN
        ALTER TABLE images ADD COLUMN title TEXT;
    END IF;
    
    -- Add description column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'images' AND column_name = 'description') THEN
        ALTER TABLE images ADD COLUMN description TEXT;
    END IF;
    
    -- Add keywords column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'images' AND column_name = 'keywords') THEN
        ALTER TABLE images ADD COLUMN keywords TEXT;
    END IF;
END $$; 