import { supabase } from '$lib/supabaseClient';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
  try {
    // Add enable_search column to profiles table
    const { error } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS enable_search BOOLEAN DEFAULT FALSE;'
    });

    if (error) {
      console.error('Error adding enable_search field:', error);
      return json({ success: false, error: error.message }, { status: 500 });
    }

    return json({ success: true, message: 'enable_search field added successfully' });
  } catch (error) {
    console.error('Error in add-search-field API:', error);
    return json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}; 