import { createClient } from '@supabase/supabase-js';

// Use environment variables with fallbacks for build process
const supabaseUrl = (typeof process !== 'undefined' && process.env?.PUBLIC_SUPABASE_URL) || 
                   (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
                   (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_SUPABASE_URL) ||
                   (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
                   'https://caskhmcbvtevdwsolvwk.supabase.co';

const supabaseServiceKey = (typeof process !== 'undefined' && process.env?.SUPABASE_SERVICE_ROLE_KEY) ||
                          (typeof import.meta !== 'undefined' && import.meta.env?.SUPABASE_SERVICE_ROLE_KEY);

if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey); 