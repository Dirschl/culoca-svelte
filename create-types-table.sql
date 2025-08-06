-- Create types table for item categorization
-- This table will store the available item types with their IDs and labels

CREATE TABLE IF NOT EXISTS types (
  id INTEGER PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the default types
INSERT INTO types (id, name, description) VALUES
  (1, 'Foto', 'Fotografien und Bilder'),
  (2, 'Event', 'Veranstaltungen und Events'),
  (3, 'Link', 'Externe Links und Verweise'),
  (4, 'Text', 'Textbeiträge und Artikel'),
  (5, 'Firma', 'Firmen- und Unternehmensinformationen'),
  (6, 'Video', 'Videomaterial und Filme')
ON CONFLICT (id) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE types IS 'Available item types for categorization';
COMMENT ON COLUMN types.id IS 'Unique type identifier';
COMMENT ON COLUMN types.name IS 'Human-readable type name';
COMMENT ON COLUMN types.description IS 'Description of the type'; 