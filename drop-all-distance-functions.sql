-- Drop ALL existing items_by_distance functions to avoid conflicts
-- This will remove all function overloads with the same name

-- Drop all possible function signatures
DROP FUNCTION IF EXISTS public.items_by_distance(uuid, uuid, integer, integer, boolean, text, double precision, double precision);
DROP FUNCTION IF EXISTS public.items_by_distance(double precision, double precision, integer, integer, uuid, boolean, uuid);
DROP FUNCTION IF EXISTS public.items_by_distance(double precision, double precision, integer, integer, uuid);
DROP FUNCTION IF EXISTS public.items_by_distance(double precision, double precision, integer, integer);
DROP FUNCTION IF EXISTS public.items_by_distance_manual(uuid, uuid, integer, integer, boolean, text, double precision, double precision);
DROP FUNCTION IF EXISTS public.items_by_distance_manual(double precision, double precision, integer, integer, uuid, boolean, uuid);
DROP FUNCTION IF EXISTS public.items_by_distance_manual(double precision, double precision, integer, integer, uuid);
DROP FUNCTION IF EXISTS public.items_by_distance_manual(double precision, double precision, integer, integer);
DROP FUNCTION IF EXISTS public.items_by_distance_unified(uuid, uuid, integer, integer, boolean, text, double precision, double precision);
DROP FUNCTION IF EXISTS public.items_by_distance_final(uuid, uuid, integer, integer, boolean, text, double precision, double precision);
DROP FUNCTION IF EXISTS public.items_by_distance_simple(uuid, uuid, integer, integer, boolean, text, double precision, double precision);
DROP FUNCTION IF EXISTS public.items_by_distance_exact(uuid, uuid, integer, integer, boolean, text, double precision, double precision);
DROP FUNCTION IF EXISTS public.items_by_distance_with_search(double precision, double precision, integer, integer, uuid, boolean, uuid, text);
DROP FUNCTION IF EXISTS public.items_by_distance_working(uuid, uuid, integer, integer, boolean, text, double precision, double precision);

-- Also drop any alias functions
DROP FUNCTION IF EXISTS public.images_by_distance(double precision, double precision, integer, integer, uuid);
DROP FUNCTION IF EXISTS public.images_by_distance(double precision, double precision, integer, integer);

-- Verify all functions are dropped
SELECT 
    'Remaining functions check' as check_type,
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name LIKE '%distance%' 
AND routine_schema = 'public'
ORDER BY routine_name; 