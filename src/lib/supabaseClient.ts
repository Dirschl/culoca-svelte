import { createClient } from '@supabase/supabase-js';

// Use environment variables with fallbacks for build process
const supabaseUrl = (typeof process !== 'undefined' && process.env?.PUBLIC_SUPABASE_URL) || 
                   (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
                   (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_SUPABASE_URL) ||
                   (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
                   'https://caskhmcbvtevdwsolvwk.supabase.co';

const supabaseAnonKey = (typeof process !== 'undefined' && process.env?.PUBLIC_SUPABASE_ANON_KEY) ||
                       (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
                       (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_SUPABASE_ANON_KEY) ||
                       (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
