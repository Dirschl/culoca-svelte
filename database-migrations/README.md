# Database Migration System

## Overview
This system helps prevent database schema issues by versioning all database changes and providing rollback capabilities.

## Structure
```
database-migrations/
├── README.md
├── migrations/
│   ├── 001_initial_schema.sql
│   ├── 002_add_postgis_functions.sql
│   └── 003_fix_function_return_types.sql
├── rollbacks/
│   ├── 001_initial_schema_rollback.sql
│   ├── 002_add_postgis_functions_rollback.sql
│   └── 003_fix_function_return_types_rollback.sql
└── migration-tracker.sql
```

## Best Practices

### 1. Always Create Migrations
- Every database change should be a numbered migration
- Include both UP and DOWN (rollback) scripts
- Test migrations on staging before production

### 2. Function Development Workflow
```sql
-- Development: Use CREATE OR REPLACE for testing
CREATE OR REPLACE FUNCTION my_function() ...

-- Production: Use proper migration
-- migrations/004_create_my_function.sql
CREATE FUNCTION my_function() ...

-- Rollback: migrations/rollbacks/004_create_my_function_rollback.sql
DROP FUNCTION IF EXISTS my_function();
```

### 3. Type Safety
- Always explicitly cast return types in functions
- Use `::text` instead of relying on implicit casting
- Test function signatures before deployment

### 4. Environment Separation
- Development: Use `CREATE OR REPLACE` for rapid iteration
- Staging: Test full migrations
- Production: Only apply tested migrations

## Migration Script Template

```sql
-- Migration: 004_fix_gallery_function_types.sql
-- Description: Fix return type mismatches in gallery functions
-- Date: 2024-01-XX
-- Author: [Your Name]

-- UP Migration
BEGIN;

-- Drop existing function
DROP FUNCTION IF EXISTS public.gallery_items_normal_postgis(double precision, double precision, integer, integer, uuid);

-- Create fixed function
CREATE FUNCTION public.gallery_items_normal_postgis(
  user_lat double precision DEFAULT 0,
  user_lon double precision DEFAULT 0,
  page_value integer DEFAULT 0,
  page_size_value integer DEFAULT 50,
  current_user_id uuid DEFAULT NULL::uuid
) 
RETURNS TABLE(
  id uuid, 
  slug text, 
  title text,  -- Explicitly text, not character varying
  description text,  -- Explicitly text, not character varying
  -- ... other columns
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.slug,
    i.title::text,  -- Explicit casting
    i.description::text,  -- Explicit casting
    -- ... rest of function
  FROM items i
  WHERE -- conditions
  ORDER BY distance ASC
  OFFSET (page_value * page_size_value)
  LIMIT page_size_value;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.gallery_items_normal_postgis(double precision, double precision, integer, integer, uuid) TO anon, authenticated, service_role;

COMMIT;
```

## Rollback Script Template

```sql
-- Rollback: 004_fix_gallery_function_types_rollback.sql
-- Description: Revert gallery function type fixes
-- Date: 2024-01-XX

BEGIN;

-- Revert to previous function definition
DROP FUNCTION IF EXISTS public.gallery_items_normal_postgis(double precision, double precision, integer, integer, uuid);

-- Recreate original function (if needed)
-- CREATE FUNCTION public.gallery_items_normal_postgis(...) AS $$ ... $$;

COMMIT;
```

## Deployment Checklist

### Before Production Deployment:
- [ ] Test migration on staging environment
- [ ] Verify function signatures match frontend expectations
- [ ] Check all permissions are granted correctly
- [ ] Test rollback procedure
- [ ] Document any breaking changes

### After Production Deployment:
- [ ] Verify functions work in production
- [ ] Monitor application logs for errors
- [ ] Update migration tracker
- [ ] Document any issues encountered

## Emergency Rollback Procedure

If a migration causes issues in production:

1. **Immediate**: Use the rollback script
2. **Investigation**: Check logs and identify root cause
3. **Fix**: Create a new migration with the fix
4. **Test**: Verify on staging before re-deploying
5. **Document**: Update migration history

## Tools & Automation

### Migration Tracker Table
```sql
CREATE TABLE IF NOT EXISTS migration_tracker (
  id SERIAL PRIMARY KEY,
  migration_name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP DEFAULT NOW(),
  applied_by VARCHAR(100),
  status VARCHAR(50) DEFAULT 'applied',
  rollback_script TEXT
);
```

### Automated Migration Script
```bash
#!/bin/bash
# deploy-migration.sh

MIGRATION_FILE=$1
ROLLBACK_FILE="rollbacks/${MIGRATION_FILE#migrations/}"

echo "Applying migration: $MIGRATION_FILE"
psql $DATABASE_URL -f $MIGRATION_FILE

if [ $? -eq 0 ]; then
  echo "Migration applied successfully"
  # Update migration tracker
  psql $DATABASE_URL -c "INSERT INTO migration_tracker (migration_name) VALUES ('$MIGRATION_FILE');"
else
  echo "Migration failed!"
  exit 1
fi
``` 