import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

// Validate environment variables
if (!VITE_SUPABASE_URL) {
  throw new Error('VITE_SUPABASE_URL is required');
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export const DELETE: RequestHandler = async ({ params }) => {
  try {
    const { id } = params;
    
    console.log('Deleting screenshot for share ID:', id);
    
    // Update the share record to remove the screenshot
    const { error } = await supabase
      .from('map_shares')
      .update({ screenshot: null })
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting screenshot:', error);
      return json({ error: 'Failed to delete screenshot' }, { status: 500 });
    }
    
    console.log('Screenshot deleted successfully');
    
    return json({ success: true });
    
  } catch (error) {
    console.error('Error in delete-screenshot:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}; 