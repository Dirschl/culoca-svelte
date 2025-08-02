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

    // SQL function to get all item_views without limits
    const sqlFunction = `
      CREATE OR REPLACE FUNCTION get_all_item_views()
      RETURNS TABLE (
        created_at TIMESTAMPTZ,
        visitor_id UUID,
        distance_meters INTEGER,
        user_agent TEXT,
        referer TEXT
      ) 
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          iv.created_at,
          iv.visitor_id,
          iv.distance_meters,
          iv.user_agent,
          iv.referer
        FROM item_views iv
        ORDER BY iv.created_at DESC;
      END;
      $$;

      GRANT EXECUTE ON FUNCTION get_all_item_views() TO authenticated;
    `;

    // Execute the SQL function creation
    const { error } = await supabase.rpc('exec_sql', { sql_query: sqlFunction });
    
    if (error) {
      console.error('Error installing analytics function:', error);
      return json({ error: 'Failed to install function', details: error }, { status: 500 });
    }

    return json({ success: true, message: 'Analytics function installed successfully' });
  } catch (error) {
    console.error('Error in install analytics function:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
} 