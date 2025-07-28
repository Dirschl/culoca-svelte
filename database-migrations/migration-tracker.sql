-- Migration Tracker Table
-- This table tracks which migrations have been applied

CREATE TABLE IF NOT EXISTS migration_tracker (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMP DEFAULT NOW(),
  applied_by VARCHAR(100) DEFAULT current_user,
  status VARCHAR(50) DEFAULT 'applied',
  rollback_script TEXT,
  checksum VARCHAR(64),
  description TEXT
);

-- Insert initial migration record for current state
INSERT INTO migration_tracker (migration_name, description, status) 
VALUES (
  '001_initial_postgis_functions', 
  'Initial PostGIS functions with proper type casting',
  'applied'
) ON CONFLICT (migration_name) DO NOTHING;

-- Function to check if migration was applied
CREATE OR REPLACE FUNCTION migration_applied(migration_name text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM migration_tracker 
    WHERE migration_name = $1 AND status = 'applied'
  );
END;
$$ LANGUAGE plpgsql;

-- Function to apply migration
CREATE OR REPLACE FUNCTION apply_migration(
  migration_name text,
  migration_sql text,
  description text DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
  -- Check if already applied
  IF migration_applied(migration_name) THEN
    RAISE NOTICE 'Migration % already applied', migration_name;
    RETURN false;
  END IF;
  
  -- Execute migration
  EXECUTE migration_sql;
  
  -- Record migration
  INSERT INTO migration_tracker (migration_name, description, status)
  VALUES (migration_name, description, 'applied');
  
  RAISE NOTICE 'Migration % applied successfully', migration_name;
  RETURN true;
END;
$$ LANGUAGE plpgsql; 