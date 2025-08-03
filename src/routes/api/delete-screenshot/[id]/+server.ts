import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';

// Use environment variables with fallbacks for build process
const supabaseUrl = (typeof process !== 'undefined' && process.env?.PUBLIC_SUPABASE_URL) || 
                   (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
                   (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_SUPABASE_URL) ||
                   (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
                   'https://caskhmcbvtevdwsolvwk.supabase.co';

const supabaseServiceKey = (typeof process !== 'undefined' && process.env?.SUPABASE_SERVICE_ROLE_KEY) ||
                          (typeof import.meta !== 'undefined' && import.meta.env?.SUPABASE_SERVICE_ROLE_KEY);

// Validate environment variables
if (!supabaseUrl) {
  throw new Error('Supabase URL is required');
}
if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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