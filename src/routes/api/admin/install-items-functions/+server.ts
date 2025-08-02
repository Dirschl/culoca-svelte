import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export async function POST() {
  try {
    // Check if user is admin
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email !== 'johann.dirschl@gmx.de' && user?.id !== '0ceb2320-0553-463b-971a-a0eef5ecdf09') {
      return json({ error: 'Access denied' }, { status: 403 });
    }

    // SQL functions for items with pagination
    const sqlFunctions = `
      -- Create a function to get all items with pagination
      CREATE OR REPLACE FUNCTION get_all_items_paginated(
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
      ) 
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
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
        ORDER BY i.created_at DESC
        LIMIT page_size
        OFFSET page_offset;
      END;
      $$;

      -- Grant execute permission to authenticated users
      GRANT EXECUTE ON FUNCTION get_all_items_paginated(INTEGER, INTEGER) TO authenticated;

      -- Create a function to get total count of items
      CREATE OR REPLACE FUNCTION get_items_count()
      RETURNS INTEGER
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
        total_count INTEGER;
      BEGIN
        SELECT COUNT(*) INTO total_count FROM items;
        RETURN total_count;
      END;
      $$;

      -- Grant execute permission to authenticated users
      GRANT EXECUTE ON FUNCTION get_items_count() TO authenticated;
    `;

    // Execute the SQL function creation
    const { error } = await supabase.rpc('exec_sql', { sql_query: sqlFunctions });
    
    if (error) {
      console.error('Error installing items functions:', error);
      return json({ error: 'Failed to install functions', details: error }, { status: 500 });
    }

    return json({ success: true, message: 'Items functions installed successfully' });
  } catch (error) {
    console.error('Error in install items functions:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
} 