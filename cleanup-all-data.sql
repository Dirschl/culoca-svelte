-- ========================================
-- ACHTUNG: DIESES SCRIPT LÖSCHT ALLE DATEN!
-- ========================================
-- Verwende dieses Script nur für Tests oder Neustart

-- 1. Alle Items aus der Datenbank löschen
DELETE FROM items;

-- 2. Sequenz zurücksetzen (falls vorhanden)
-- ALTER SEQUENCE items_id_seq RESTART WITH 1;

-- 3. Bestätige Löschung
SELECT 'Alle Items gelöscht. Anzahl verbleibender Einträge:' as status, COUNT(*) as count FROM items; 