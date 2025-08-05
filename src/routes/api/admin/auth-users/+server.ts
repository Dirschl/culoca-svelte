import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseAdmin.js';

export const GET = async () => {
  try {
    if (!supabaseAdmin) {
      return json({ error: 'Admin operations not available - SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 503 });
    }

    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers();
    
    if (error) {
      console.error('Error listing auth users:', error);
      return json({ error: error.message }, { status: 500 });
    }

    // Filter to only return necessary fields
    const filteredUsers = users.users.map(user => ({
      id: user.id,
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      updated_at: user.updated_at,
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata,
      identities: user.identities,
      last_sign_in_with: user.last_sign_in_with,
      phone: user.phone,
      phone_confirmed_at: user.phone_confirmed_at
    }));

    return json(filteredUsers);
  } catch (error) {
    console.error('Error in auth-users API:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

export const POST = async ({ request }) => {
  try {
    if (!supabaseAdmin) {
      return json({ error: 'Admin operations not available - SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 503 });
    }

    const { email } = await request.json();
    
    if (!email) {
      return json({ error: 'Email is required' }, { status: 400 });
    }

    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers();
    
    if (error) {
      console.error('Error listing auth users:', error);
      return json({ error: error.message }, { status: 500 });
    }

    const existingUser = users.users.find(user => user.email === email);
    
    return json({
      exists: !!existingUser,
      user: existingUser ? {
        id: existingUser.id,
        email: existingUser.email,
        email_confirmed_at: existingUser.email_confirmed_at,
        created_at: existingUser.created_at
      } : null
    });
  } catch (error) {
    console.error('Error checking email:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}; 