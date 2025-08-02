import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { supabase } = await import('$lib/supabaseClient');
    
    // SQL for extended search functions
    const sql = `
      -- Extended search functions for admin items with multiple search terms
      -- These functions support searching with two optional search terms

      -- Function to search items with two optional search terms
      CREATE OR REPLACE FUNCTION search_all_items_extended(
        search_query1 TEXT DEFAULT '',
        search_query2 TEXT DEFAULT '',
        page_offset INTEGER DEFAULT 0,
        page_size INTEGER DEFAULT 50
      )
      RETURNS TABLE (
        id UUID,
        title TEXT,
        slug TEXT,
        created_at TIMESTAMPTZ,
        lat DOUBLE PRECISION,
        lon DOUBLE PRECISION,
        is_private BOOLEAN,
        user_id UUID,
        width INTEGER,
        height INTEGER,
        path_512 TEXT,
        accountname TEXT,
        full_name TEXT
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          i.id,
          i.title,
          i.slug,
          i.created_at,
          i.lat,
          i.lon,
          i.is_private,
          i.user_id,
          i.width,
          i.height,
          i.path_512,
          p.accountname,
          p.full_name
        FROM items i
        LEFT JOIN profiles p ON i.user_id = p.id
        WHERE 
          (search_query1 = '' OR 
           i.title ILIKE '%' || search_query1 || '%' OR 
           i.slug ILIKE '%' || search_query1 || '%' OR
           p.accountname ILIKE '%' || search_query1 || '%')
          AND
          (search_query2 = '' OR 
           i.title ILIKE '%' || search_query2 || '%' OR 
           i.slug ILIKE '%' || search_query2 || '%' OR
           p.accountname ILIKE '%' || search_query2 || '%')
        ORDER BY i.created_at DESC
        LIMIT page_size
        OFFSET page_offset;
      END;
      $$ LANGUAGE plpgsql;

      -- Function to count search results with two optional search terms
      CREATE OR REPLACE FUNCTION get_search_count_extended(
        search_query1 TEXT DEFAULT '',
        search_query2 TEXT DEFAULT ''
      )
      RETURNS INTEGER AS $$
      DECLARE
        result_count INTEGER;
      BEGIN
        SELECT COUNT(*)
        INTO result_count
        FROM items i
        LEFT JOIN profiles p ON i.user_id = p.id
        WHERE 
          (search_query1 = '' OR 
           i.title ILIKE '%' || search_query1 || '%' OR 
           i.slug ILIKE '%' || search_query1 || '%' OR
           p.accountname ILIKE '%' || search_query1 || '%')
          AND
          (search_query2 = '' OR 
           i.title ILIKE '%' || search_query2 || '%' OR 
           i.slug ILIKE '%' || search_query2 || '%' OR
           p.accountname ILIKE '%' || search_query2 || '%');
        
        RETURN result_count;
      END;
      $$ LANGUAGE plpgsql;
    `;

    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('Error installing extended search functions:', error);
      return json({ error: 'Failed to install extended search functions', details: error }, { status: 500 });
    }

    return json({ success: true, message: 'Extended search functions installed successfully' });
  } catch (error) {
    console.error('Error in install-extended-search-functions:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}; 