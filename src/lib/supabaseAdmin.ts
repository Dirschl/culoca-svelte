import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Function to read .env.local directly
function readEnvLocal() {
  try {
    if (typeof process !== 'undefined') {
      const envPath = join(process.cwd(), '.env.local');
      const envContent = readFileSync(envPath, 'utf8');
      const envVars = {};
      
      envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          if (value && !key.startsWith('#')) {
            envVars[key.trim()] = value;
          }
        }
      });
      
      return envVars;
    }
  } catch (error) {
    console.log('Could not read .env.local directly:', error.message);
  }
  return {};
}

// Use environment variables with fallbacks for build process
const supabaseUrl = (typeof process !== 'undefined' && process.env?.PUBLIC_SUPABASE_URL) || 
                   (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
                   (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_SUPABASE_URL) ||
                   (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
                   'https://caskhmcbvtevdwsolvwk.supabase.co';

let supabaseServiceKey = (typeof process !== 'undefined' && process.env?.SUPABASE_SERVICE_ROLE_KEY) ||
                        (typeof import.meta !== 'undefined' && import.meta.env?.SUPABASE_SERVICE_ROLE_KEY);

// Fallback: read directly from .env.local
if (!supabaseServiceKey && typeof process !== 'undefined') {
  const envLocal = readEnvLocal();
  supabaseServiceKey = envLocal.SUPABASE_SERVICE_ROLE_KEY;
  console.log('🔍 Fallback: Read SUPABASE_SERVICE_ROLE_KEY from .env.local directly');
}

console.log('🔍 Debug: supabaseServiceKey found:', !!supabaseServiceKey);
console.log('🔍 Debug: supabaseServiceKey length:', supabaseServiceKey?.length || 0);

// Create admin client only when service key is available
let supabaseAdmin = null;

if (supabaseServiceKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  console.log('✅ Supabase admin client created successfully');
} else {
  console.warn('❌ SUPABASE_SERVICE_ROLE_KEY not found - admin operations will not work');
  console.log('🔍 Debug: Available env vars:', {
    processEnv: typeof process !== 'undefined' ? Object.keys(process.env || {}).filter(k => k.includes('SUPABASE')) : 'N/A',
    importMetaEnv: typeof import.meta !== 'undefined' ? Object.keys(import.meta.env || {}).filter(k => k.includes('SUPABASE')) : 'N/A'
  });
}

export { supabaseAdmin }; 