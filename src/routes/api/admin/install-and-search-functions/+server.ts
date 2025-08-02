import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { supabase } = await import('$lib/supabaseClient');
    
    // SQL for AND search functions
    const sql = `
      -- AND search functions for admin items - all search terms must be satisfied
      -- These functions support searching with multiple terms using AND logic

      -- Function to search items with AND logic (all terms must be found)
      CREATE OR REPLACE FUNCTION search_all_items_and(
        search_query TEXT DEFAULT '',
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
      DECLARE
        search_terms TEXT[];
        term TEXT;
        query_conditions TEXT := '';
      BEGIN
        -- Split search query into individual terms
        search_terms := string_to_array(trim(search_query), ' ');
        
        -- Build conditions for each term
        FOR i IN 1..array_length(search_terms, 1) LOOP
          term := search_terms[i];
          IF term != '' THEN
            -- Each term must be found in title OR slug OR accountname
            IF query_conditions != '' THEN
              query_conditions := query_conditions || ' AND ';
            END IF;
            query_conditions := query_conditions || 
              '(LOWER(i.title) LIKE LOWER(''%' || term || '%'') OR ' ||
              'LOWER(i.slug) LIKE LOWER(''%' || term || '%'') OR ' ||
              'LOWER(p.accountname) LIKE LOWER(''%' || term || '%''))';
          END IF;
        END LOOP;
        
        -- If no search terms, return all items
        IF query_conditions = '' THEN
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
          ORDER BY i.created_at DESC
          LIMIT page_size OFFSET page_offset;
        ELSE
          -- Execute search with AND conditions
          RETURN QUERY EXECUTE '
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
            WHERE ' || query_conditions || '
            ORDER BY i.created_at DESC
            LIMIT ' || page_size || ' OFFSET ' || page_offset;
        END IF;
      END;
      $$ LANGUAGE plpgsql;

      -- Function to count items with AND logic
      CREATE OR REPLACE FUNCTION get_search_count_and(
        search_query TEXT DEFAULT ''
      )
      RETURNS INTEGER AS $$
      DECLARE
        search_terms TEXT[];
        term TEXT;
        query_conditions TEXT := '';
        result_count INTEGER;
      BEGIN
        -- Split search query into individual terms
        search_terms := string_to_array(trim(search_query), ' ');
        
        -- Build conditions for each term
        FOR i IN 1..array_length(search_terms, 1) LOOP
          term := search_terms[i];
          IF term != '' THEN
            -- Each term must be found in title OR slug OR accountname
            IF query_conditions != '' THEN
              query_conditions := query_conditions || ' AND ';
            END IF;
            query_conditions := query_conditions || 
              '(LOWER(i.title) LIKE LOWER(''%' || term || '%'') OR ' ||
              'LOWER(i.slug) LIKE LOWER(''%' || term || '%'') OR ' ||
              'LOWER(p.accountname) LIKE LOWER(''%' || term || '%''))';
          END IF;
        END LOOP;
        
        -- If no search terms, count all items
        IF query_conditions = '' THEN
          SELECT COUNT(*) INTO result_count
          FROM items i
          LEFT JOIN profiles p ON i.user_id = p.id;
        ELSE
          -- Execute count with AND conditions
          EXECUTE 'SELECT COUNT(*) FROM items i LEFT JOIN profiles p ON i.user_id = p.id WHERE ' || query_conditions
          INTO result_count;
        END IF;
        
        RETURN result_count;
      END;
      $$ LANGUAGE plpgsql;
    `;

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('Error installing AND search functions:', error);
      return json({ success: false, error: error.message }, { status: 500 });
    }

    return json({ success: true, message: 'AND search functions installed successfully' });
  } catch (error) {
    console.error('Error installing AND search functions:', error);
    return json({ success: false, error: 'Failed to install AND search functions' }, { status: 500 });
  }
}; 