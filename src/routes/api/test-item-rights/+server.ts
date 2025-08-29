import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
  // Create Supabase client directly
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    return json({ error: 'Missing Supabase environment variables' }, { status: 500 });
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Get session from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json({ error: 'Nicht angemeldet' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return json({ error: 'Nicht angemeldet' }, { status: 401 });
    }

    const userId = user.id;
    
    console.log('🔍 Testing item-rights system for user:', userId);
    
    const results = {
      tables: {},
      functions: {},
      user: { id: userId }
    };

    // Test 1: Check if profile_rights table exists
    try {
      const { data: profileRights, error } = await supabase
        .from('profile_rights')
        .select('count(*)')
        .limit(1);
      
      results.tables.profile_rights = {
        exists: !error,
        error: error?.message || null
      };
    } catch (error) {
      results.tables.profile_rights = {
        exists: false,
        error: error.message
      };
    }

    // Test 2: Check if item_rights table exists
    try {
      const { data: itemRights, error } = await supabase
        .from('item_rights')
        .select('count(*)')
        .limit(1);
      
      results.tables.item_rights = {
        exists: !error,
        error: error?.message || null
      };
    } catch (error) {
      results.tables.item_rights = {
        exists: false,
        error: error.message
      };
    }

    // Test 3: Check if check_item_rights function exists
    try {
      const { data: functionTest, error } = await supabase.rpc('check_item_rights', {
        p_item_id: '00000000-0000-0000-0000-000000000000',
        p_user_id: userId,
        p_right_type: 'download'
      });
      
      results.functions.check_item_rights = {
        exists: !error || error.code !== '42883', // 42883 = function does not exist
        error: error?.message || null
      };
    } catch (error) {
      results.functions.check_item_rights = {
        exists: false,
        error: error.message
      };
    }

    // Test 4: Check if get_user_item_rights function exists
    try {
      const { data: functionTest, error } = await supabase.rpc('get_user_item_rights', {
        p_item_id: '00000000-0000-0000-0000-000000000000',
        p_user_id: userId
      });
      
      results.functions.get_user_item_rights = {
        exists: !error || error.code !== '42883',
        error: error?.message || null
      };
    } catch (error) {
      results.functions.get_user_item_rights = {
        exists: false,
        error: error.message
      };
    }

    // Test 5: Check if user has any images
    try {
      const { data: images, error } = await supabase
        .from('images')
        .select('id, title')
        .eq('user_id', userId)
        .limit(1);
      
      results.user.hasImages = {
        exists: !error,
        count: images?.length || 0,
        error: error?.message || null
      };
    } catch (error) {
      results.user.hasImages = {
        exists: false,
        error: error.message
      };
    }

    console.log('✅ Item-rights system test results:', results);
    return json(results);
    
  } catch (error) {
    console.error('Error in test-item-rights:', error);
    return json({ error: 'Server-Fehler' }, { status: 500 });
  }
};
