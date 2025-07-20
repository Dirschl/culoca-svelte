import { json } from '@sveltejs/kit';
import { supabaseService } from '$lib/supabaseClient';

export const POST = async () => {
  try {
    // Test the current function
    const { data: testData, error: testError } = await supabaseService
      .rpc('images_by_distance_optimized', {
        user_lat: 48.3380921172401,
        user_lon: 12.6950471210948,
        max_radius_meters: 50000,
        max_results: 10
      });

    if (testError) {
      console.error('Test function error:', testError);
      
      // Try to fix the function
      const fixQuery = `
        DROP FUNCTION IF EXISTS images_by_distance_optimized(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER);
        
        CREATE OR REPLACE FUNCTION images_by_distance_optimized(
          user_lat DOUBLE PRECISION,
          user_lon DOUBLE PRECISION,
          max_radius_meters INTEGER DEFAULT 5000,
          max_results INTEGER DEFAULT 100
        )
        RETURNS TABLE (
          id UUID,
          path_512 TEXT,
          path_2048 TEXT,
          path_64 TEXT,
          width INTEGER,
          height INTEGER,
          lat DOUBLE PRECISION,
          lon DOUBLE PRECISION,
          title TEXT,
          description TEXT,
          keywords TEXT[],
          distance_meters DOUBLE PRECISION,
          created_at TIMESTAMPTZ
        ) AS $$
        BEGIN
          RETURN QUERY
          SELECT 
            i.id,
            i.path_512,
            i.path_2048,
            i.path_64,
            i.width,
            i.height,
            i.lat,
            i.lon,
            i.title,
            i.description,
            i.keywords,
            (6371000 * acos(
              cos(radians(user_lat)) * 
              cos(radians(i.lat)) * 
              cos(radians(i.lon) - radians(user_lon)) + 
              sin(radians(user_lat)) * 
              sin(radians(i.lat))
            )) as distance_meters,
            i.created_at
          FROM items i
          WHERE 
            i.lat IS NOT NULL 
            AND i.lon IS NOT NULL
            AND i.path_512 IS NOT NULL
            AND i.path_2048 IS NOT NULL
            AND (6371000 * acos(
              cos(radians(user_lat)) * 
              cos(radians(i.lat)) * 
              cos(radians(i.lon) - radians(user_lon)) + 
              sin(radians(user_lat)) * 
              sin(radians(i.lat))
            )) <= max_radius_meters
          ORDER BY distance_meters ASC
          LIMIT max_results;
        END;
        $$ LANGUAGE plpgsql;
      `;
      
      const { error: fixError } = await supabaseService.rpc('exec_sql', { sql: fixQuery });
      
      if (fixError) {
        console.error('Fix function error:', fixError);
        return json({ error: 'Failed to fix function', details: fixError });
      }
      
      // Test the fixed function
      const { data: fixedData, error: fixedError } = await supabaseService
        .rpc('images_by_distance_optimized', {
          user_lat: 48.3380921172401,
          user_lon: 12.6950471210948,
          max_radius_meters: 50000,
          max_results: 10
        });
      
      if (fixedError) {
        return json({ error: 'Function still broken after fix', details: fixedError });
      }
      
      return json({ 
        status: 'Function fixed successfully', 
        testData: fixedData,
        count: fixedData?.length || 0
      });
    }
    
    return json({ 
      status: 'Function working correctly', 
      testData,
      count: testData?.length || 0
    });
    
  } catch (error) {
    console.error('Test DB error:', error);
    return json({ error: 'Test failed', details: error });
  }
}; 