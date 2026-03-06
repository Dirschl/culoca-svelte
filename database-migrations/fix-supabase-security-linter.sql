-- =============================================================================
-- FIX SUPABASE SECURITY LINTER ISSUES
-- =============================================================================
-- Behebt alle gemeldeten Security Advisor Meldungen:
-- 1. policy_exists_rls_disabled  - RLS aktivieren wo Policies existieren
-- 2. security_definer_view      - Views auf SECURITY INVOKER umstellen
-- 3. rls_disabled_in_public     - RLS aktivieren und Policies für alle Tabellen
--
-- Vor dem Ausführen: Backup erstellen. Ausführen in Supabase SQL Editor.
-- Danach App testen (insb. Suche, Profilrechte, Galerie, public_profiles).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. POLICY_EXISTS_RLS_DISABLED - Tabellen mit Policies, aber RLS aus
-- =============================================================================
-- Diese Tabellen haben bereits Policies, RLS war aber deaktiviert (z.B. durch
-- disable-rls-*.sql). Wir aktivieren RLS.

ALTER TABLE IF EXISTS public.item_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.item_rights ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profile_rights ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- 2. RLS_DISABLED_IN_PUBLIC - Tabellen ohne RLS
-- =============================================================================

-- item_views: View-Tracking (Insert für alle, Select für Item-Besitzer)
ALTER TABLE IF EXISTS public.item_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow insert for all users" ON public.item_views;
CREATE POLICY "Allow insert for all users" ON public.item_views
  FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow select for item owners" ON public.item_views;
CREATE POLICY "Allow select for item owners" ON public.item_views
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.items
      WHERE items.id = item_views.item_id
      AND items.user_id = auth.uid()
    )
  );

-- migration_tracker: Nur Lesen für alle (Namen sind nicht sensibel)
ALTER TABLE IF EXISTS public.migration_tracker ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read for all" ON public.migration_tracker;
CREATE POLICY "Allow read for all" ON public.migration_tracker
  FOR SELECT USING (true);
-- INSERT/UPDATE/DELETE: Keine Policy = nur service_role/superuser (bypass RLS)

-- roles: Lookup-Tabelle, Lesen für alle
ALTER TABLE IF EXISTS public.roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read roles for all" ON public.roles;
CREATE POLICY "Allow read roles for all" ON public.roles
  FOR SELECT USING (true);

-- types: Lookup-Tabelle (Foto, Event, etc.), Lesen für alle
ALTER TABLE IF EXISTS public.types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read types for all" ON public.types;
CREATE POLICY "Allow read types for all" ON public.types
  FOR SELECT USING (true);

-- spatial_ref_sys: PostGIS-Systemtabelle – nicht änderbar (nicht Owner).
-- Der Linter-Hinweis kann ignoriert werden; die Tabelle ist read-only Referenzdaten.


-- =============================================================================
-- 3. SECURITY_DEFINER_VIEW - Views auf INVOKER umstellen
-- =============================================================================
-- Views laufen aktuell mit SECURITY DEFINER (Rechte des Erstellers).
-- Mit INVOKER laufen sie mit den Rechten des aufrufenden Users.
-- Die zugrundeliegenden Tabellen (items, profiles) haben RLS – die Policies
-- greifen dann korrekt. Prüfe nach dem Ausführen: Suche, Profilrechte, Galerie.

-- PostgreSQL 15+ Syntax
ALTER VIEW IF EXISTS public.items_normal_view SET (security_invoker = on);
ALTER VIEW IF EXISTS public.public_profiles SET (security_invoker = on);
ALTER VIEW IF EXISTS public.items_search_view SET (security_invoker = on);
ALTER VIEW IF EXISTS public.user_permissions_view SET (security_invoker = on);


COMMIT;

-- Bestätigung
SELECT 'Supabase Security Linter Issues behoben.' AS status;
