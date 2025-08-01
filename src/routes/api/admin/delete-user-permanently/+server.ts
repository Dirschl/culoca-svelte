import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseAdmin.js';

export const POST = async ({ request }) => {
  try {
    if (!supabaseAdmin) {
      return json({ error: 'Admin operations not available - SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 503 });
    }

    const { userId } = await request.json();

    if (!userId) {
      return json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log(`🗑️ Attempting to permanently delete user: ${userId}`);

    // First, get the user to check if they exist
    const { data: user, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    if (getUserError) {
      console.error('Error getting user:', getUserError);
      return json({ error: `Failed to get user: ${getUserError.message}` }, { status: 500 });
    }

    if (!user.user) {
      return json({ error: 'User not found' }, { status: 404 });
    }

    console.log(`🗑️ Found user: ${user.user.email} (${userId})`);

    // Delete the user permanently
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      return json({ error: `Failed to delete user: ${deleteError.message}` }, { status: 500 });
    }

    console.log(`✅ User ${userId} (${user.user.email}) permanently deleted`);

    return json({ 
      success: true, 
      message: `User ${user.user.email} permanently deleted`,
      deletedUser: {
        id: userId,
        email: user.user.email
      }
    });

  } catch (error) {
    console.error('Error in delete-user-permanently API:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}; 