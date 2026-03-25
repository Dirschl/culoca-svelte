-- =============================================================================
-- Supabase Security Linter: rls_disabled_in_public (0013)
-- =============================================================================
-- WICHTIG: Drei getrennte COMMIT-Blöcke. Wenn alles in EINER Transaktion steht
-- und z.B. spatial_ref_sys fehlschlägt, rollt Postgres ALLES zurück — dann wirkt
-- RLS nirgends und der Advisor meldet weiter alle drei Tabellen.
--
-- Im SQL Editor der Reihe nach ausführen (alles auf einmal Einfügen + Run ist ok).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Block 1 — geo_taxonomy_nodes (zuerst)
-- -----------------------------------------------------------------------------
BEGIN;

ALTER TABLE IF EXISTS public.geo_taxonomy_nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "geo_taxonomy_nodes_select_all" ON public.geo_taxonomy_nodes;
CREATE POLICY "geo_taxonomy_nodes_select_all" ON public.geo_taxonomy_nodes
  FOR SELECT
  USING (true);

COMMIT;

-- -----------------------------------------------------------------------------
-- Block 2 — item_similarity_vectors (keine SELECT-Policy = kein REST-Lesevollzugriff)
-- -----------------------------------------------------------------------------
BEGIN;

ALTER TABLE IF EXISTS public.item_similarity_vectors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "item_similarity_vectors_select_authenticated" ON public.item_similarity_vectors;
DROP POLICY IF EXISTS "item_similarity_vectors_select_all" ON public.item_similarity_vectors;

COMMIT;

-- -----------------------------------------------------------------------------
-- Block 3 — spatial_ref_sys (PostGIS, Supabase Hosted)
-- -----------------------------------------------------------------------------
-- Auf Supabase ist Owner oft supabase_admin → „must be owner“ für ENABLE RLS und
-- für OWNER TO postgres. Lint 0013 kann dann EIN ERROR bleiben (bekanntes
-- Plattform-Thema). Praktischer Schutz zuerst: PostgREST-Zugriff entziehen.

BEGIN;

REVOKE ALL ON TABLE public.spatial_ref_sys FROM PUBLIC;
REVOKE ALL ON TABLE public.spatial_ref_sys FROM anon;
REVOKE ALL ON TABLE public.spatial_ref_sys FROM authenticated;

COMMIT;

-- Optional — nur wenn ihr spatial_ref_sys auf postgres besitzt (z. B. Self-Hosted
-- oder nach manueller Änderung durch Support). Sonst auslassen.
--
-- ALTER TABLE public.spatial_ref_sys OWNER TO postgres;
-- BEGIN;
-- ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "spatial_ref_sys_select_reference" ON public.spatial_ref_sys;
-- CREATE POLICY "spatial_ref_sys_select_reference" ON public.spatial_ref_sys
--   FOR SELECT USING (true);
-- COMMIT;

-- =============================================================================
-- Prüfen (einzeln ausführen): relrowsecurity = true → RLS an
-- =============================================================================
-- SELECT n.nspname AS schema, c.relname AS table, c.relrowsecurity AS rls_on
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND c.relname IN ('spatial_ref_sys', 'geo_taxonomy_nodes', 'item_similarity_vectors')
--   AND c.relkind = 'r';
