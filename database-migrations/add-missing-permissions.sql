-- Add missing permissions to roles table
-- Fügt die fehlenden Berechtigungen zur roles Tabelle hinzu
-- Führe dieses Script im Supabase Dashboard aus

-- Update anonymous role
UPDATE roles 
SET permissions = permissions || '{"download": false, "download_original": false, "edit": false, "delete": false}'::JSONB
WHERE id = 1;

-- Update user role
UPDATE roles 
SET permissions = permissions || '{"download": true, "download_original": false, "edit": true, "delete": false}'::JSONB
WHERE id = 2;

-- Update admin role
UPDATE roles 
SET permissions = permissions || '{"download": true, "download_original": true, "edit": true, "delete": true}'::JSONB
WHERE id = 3;

-- Confirmation
SELECT 'Missing permissions added successfully!' as status;
