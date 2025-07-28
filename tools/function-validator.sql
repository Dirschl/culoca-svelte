-- Function Validator Tool
-- Use this to test function signatures and return types before deployment

-- 1. Test function exists and has correct signature
CREATE OR REPLACE FUNCTION validate_function_signature(
  function_name text,
  expected_params text[]
) RETURNS TABLE(
  function_exists boolean,
  param_count integer,
  param_names text[],
  param_types text[],
  return_type text,
  validation_passed boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE WHEN p.proname IS NOT NULL THEN true ELSE false END as function_exists,
    COUNT(p.proargtypes) as param_count,
    ARRAY_AGG(p.proargnames) as param_names,
    ARRAY_AGG(t.typname) as param_types,
    rt.typname as return_type,
    CASE 
      WHEN p.proname IS NOT NULL 
        AND COUNT(p.proargtypes) = array_length(expected_params, 1)
      THEN true 
      ELSE false 
    END as validation_passed
  FROM pg_proc p
  LEFT JOIN pg_type t ON t.oid = ANY(p.proargtypes)
  LEFT JOIN pg_type rt ON rt.oid = p.prorettype
  WHERE p.proname = function_name
  GROUP BY p.proname, rt.typname;
END;
$$ LANGUAGE plpgsql;

-- 2. Test function return types match expectations
CREATE OR REPLACE FUNCTION test_function_return_types(
  function_name text,
  test_params jsonb
) RETURNS TABLE(
  test_result jsonb,
  error_message text,
  success boolean
) AS $$
DECLARE
  result jsonb;
  error_msg text;
BEGIN
  BEGIN
    -- Execute function with test parameters
    EXECUTE format('SELECT to_jsonb(t.*) FROM %I(%s) t LIMIT 1', 
                   function_name, 
                   (SELECT string_agg(value::text, ',') FROM jsonb_array_elements(test_params)))
    INTO result;
    
    RETURN QUERY SELECT result, NULL::text, true;
  EXCEPTION WHEN OTHERS THEN
    error_msg := SQLERRM;
    RETURN QUERY SELECT NULL::jsonb, error_msg, false;
  END;
END;
$$ LANGUAGE plpgsql;

-- 3. Validate specific functions
-- Example usage for gallery_items_normal_postgis
SELECT * FROM validate_function_signature(
  'gallery_items_normal_postgis',
  ARRAY['double precision', 'double precision', 'integer', 'integer', 'uuid']
);

-- Test the function with sample parameters
SELECT * FROM test_function_return_types(
  'gallery_items_normal_postgis',
  '[0, 0, 0, 50, null]'::jsonb
);

-- 4. Check function permissions
SELECT 
  p.proname as function_name,
  r.rolname as granted_to,
  has_function_privilege(r.oid, p.oid, 'EXECUTE') as has_execute
FROM pg_proc p
CROSS JOIN pg_roles r
WHERE p.proname = 'gallery_items_normal_postgis'
  AND r.rolname IN ('anon', 'authenticated', 'service_role')
ORDER BY r.rolname; 