import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/supabaseAdmin.js';

export const POST = async ({ request }) => {
  try {
    if (!supabaseAdmin) {
      return json({ error: 'Admin operations not available - SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 503 });
    }

    const { fromUserId, toUserId, itemIds } = await request.json();

    if (!fromUserId || !toUserId) {
      return json({ error: 'From user ID and to user ID are required' }, { status: 400 });
    }

    console.log(`🔄 Reassigning items from ${fromUserId} to ${toUserId}`);

    let query = supabaseAdmin
      .from('items')
      .update({ profile_id: toUserId })
      .eq('profile_id', fromUserId);

    // If specific item IDs are provided, filter by them
    if (itemIds && itemIds.length > 0) {
      query = query.in('id', itemIds);
    }

    const { data: updatedItems, error } = await query.select();

    if (error) {
      console.error('Error reassigning items:', error);
      return json({ error: `Failed to reassign items: ${error.message}` }, { status: 500 });
    }

    console.log(`✅ Successfully reassigned ${updatedItems?.length || 0} items`);

    // Refresh cache after reassignment
    console.log('🔄 Refreshing cache after reassignment...');
    await supabaseAdmin
      .from('items')
      .select('*')
      .limit(1);

    return json({ 
      success: true, 
      message: `Successfully reassigned ${updatedItems?.length || 0} items`,
      fromUserId,
      toUserId,
      reassignedItems: updatedItems || [],
      count: updatedItems?.length || 0
    });

  } catch (error) {
    console.error('Error in reassign-items API:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}; 