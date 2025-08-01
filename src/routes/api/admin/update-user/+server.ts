import { json } from '@sveltejs/kit';
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
    const { userId, updates } = await request.json();

    if (!userId) {
      return json({ error: 'User ID is required' }, { status: 400 });
    }

    const results = {};

    // Update auth user if email is being changed
    if (updates.email) {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { email: updates.email }
      );

      if (authError) {
        console.error('Error updating auth user:', authError);
        return json({ error: `Auth update failed: ${authError.message}` }, { status: 500 });
      }

      results.auth = 'updated';
    }

    // Update profile
    const profileUpdates = {};
    if (updates.full_name !== undefined) profileUpdates.full_name = updates.full_name;
    if (updates.accountname !== undefined) profileUpdates.accountname = updates.accountname;
    if (updates.privacy_mode !== undefined) profileUpdates.privacy_mode = updates.privacy_mode;
    if (updates.save_originals !== undefined) profileUpdates.save_originals = updates.save_originals;
    if (updates.use_justified_layout !== undefined) profileUpdates.use_justified_layout = updates.use_justified_layout;
    if (updates.show_welcome !== undefined) profileUpdates.show_welcome = updates.show_welcome;

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdates)
        .eq('id', userId);

      if (profileError) {
        console.error('Error updating profile:', profileError);
        return json({ error: `Profile update failed: ${profileError.message}` }, { status: 500 });
      }

      results.profile = 'updated';
    }

    console.log(`✅ User ${userId} updated successfully:`, results);
    return json({ success: true, results });

  } catch (error) {
    console.error('Error in update-user API:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}; 