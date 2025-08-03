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

// Create client with proper error handling for build process
let supabase;
try {
  if (!supabaseAnonKey) {
    // For build process, create a dummy client that won't be used
    supabase = createClient(supabaseUrl, 'dummy-key-for-build');
  } else {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
} catch (error) {
  console.warn('Failed to create Supabase client:', error);
  // Create a dummy client for build process
  supabase = createClient(supabaseUrl, 'dummy-key-for-build');
}

export { supabase };
