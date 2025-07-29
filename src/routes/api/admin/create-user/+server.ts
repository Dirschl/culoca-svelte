import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

// Service role client for admin operations
const supabaseUrl = (process.env.PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL)!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export const POST = async ({ request }) => {
  try {
    const { email, password, fullName, accountName } = await request.json();

    // Validate input
    if (!email || !password || !fullName) {
      throw error(400, 'Email, password, and full name are required');
    }

    // Create user with Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName,
        account_name: accountName || fullName
      }
    });

    if (authError) {
      console.error('Auth creation error:', authError);
      throw error(500, `Failed to create user: ${authError.message}`);
    }

    const userId = authData.user.id;

    // Create profile record
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        full_name: fullName,
        accountname: accountName || fullName,
        use_justified_layout: true,
        show_welcome: true,
        privacy_mode: 'public',
        save_originals: true
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Try to delete the auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw error(500, `Failed to create profile: ${profileError.message}`);
    }

    console.log(`✅ User created successfully: ${email} (${userId})`);

    return json({
      success: true,
      user: {
        id: userId,
        email: authData.user.email,
        full_name: fullName,
        account_name: accountName || fullName
      },
      message: 'User created successfully'
    });

  } catch (err) {
    console.error('Admin create user error:', err);
    
    if (err.status) {
      throw err; // Re-throw SvelteKit errors
    }
    
    throw error(500, `Internal server error: ${err.message}`);
  }
}; 