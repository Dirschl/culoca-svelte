import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

// Service role client for admin operations
const supabaseUrl = (process.env.PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL)!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export const GET = async () => {
  try {
    // Get all auth users with basic info
    const { data: authUsers, error } = await supabaseAdmin.auth.admin.listUsers();
    
    if (error) {
      console.error('Error loading auth users:', error);
      return json({ error: error.message }, { status: 500 });
    }

    // Return only necessary fields for admin display
    const users = authUsers.users.map(user => ({
      id: user.id,
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      user_metadata: user.user_metadata
    }));

    return json(users);
  } catch (error) {
    console.error('Error in auth-users API:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}; 