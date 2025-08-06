import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export const GET: RequestHandler = async ({ locals }) => {
  try {
    const { data: { user } } = await locals.getSession();
    
    if (!user) {
      return json({ hasAdminPermission: false });
    }

    // Check if user has admin permission
    const { data: hasPermission, error } = await supabase.rpc('has_permission', {
      user_id: user.id,
      permission_name: 'admin'
    });

    if (error) {
      console.error('Admin permission check error:', error);
      return json({ hasAdminPermission: false });
    }

    return json({ hasAdminPermission: hasPermission || false });

  } catch (error) {
    console.error('Admin permission check failed:', error);
    return json({ hasAdminPermission: false });
  }
}; 