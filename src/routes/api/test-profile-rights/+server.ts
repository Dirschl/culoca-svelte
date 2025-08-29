import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';

// GET: Test der Profilrechte-Tabellen
export const GET: RequestHandler = async () => {
  try {
    console.log('🔍 Test endpoint started');
    
    // Create Supabase client directly
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return json({ error: 'Missing Supabase environment variables' }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const results: any = {};
    
    console.log('🔍 Test endpoint (no authentication)');
    
    // Test 1: Profile Rights Tabelle
    console.log('📋 Testing profile_rights table...');
    try {
      const { data: profileRights, error: prError } = await supabase
        .from('profile_rights')
        .select('*')
        .limit(1);

      results.profileRights = {
        exists: true,
        error: prError?.message || null,
        count: profileRights?.length || 0
      };
      console.log('✅ profile_rights test completed');
    } catch (error) {
      results.profileRights = {
        exists: false,
        error: error instanceof Error ? error.message : String(error),
        count: 0
      };
      console.log('❌ profile_rights test failed:', error);
    }
    
    // Test 2: Item Rights Tabelle
    console.log('📋 Testing item_rights table...');
    try {
      const { data: itemRights, error: irError } = await supabase
        .from('item_rights')
        .select('*')
        .limit(1);

      results.itemRights = {
        exists: true,
        error: irError?.message || null,
        count: itemRights?.length || 0
      };
      console.log('✅ item_rights test completed');
    } catch (error) {
      results.itemRights = {
        exists: false,
        error: error instanceof Error ? error.message : String(error),
        count: 0
      };
      console.log('❌ item_rights test failed:', error);
    }
    
    // Test 3: Profiles Tabelle
    console.log('👥 Testing profiles table...');
    try {
      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .limit(5);

      results.profiles = {
        exists: true,
        error: pError?.message || null,
        count: profiles?.length || 0,
        sample: profiles?.slice(0, 2) || []
      };
      console.log('✅ profiles test completed');
    } catch (error) {
      results.profiles = {
        exists: false,
        error: error instanceof Error ? error.message : String(error),
        count: 0,
        sample: []
      };
      console.log('❌ profiles test failed:', error);
    }
    
    // Test 4: Datenbank-Funktionen
    console.log('⚙️ Testing database functions...');
    try {
      const { data: functionTest, error: fError } = await supabase.rpc('check_item_rights', {
        p_item_id: '00000000-0000-0000-0000-000000000000',
        p_user_id: '00000000-0000-0000-0000-000000000000',
        p_right_type: 'download'
      });

      results.functions = {
        exists: true,
        error: fError?.message || null,
        result: functionTest
      };
      console.log('✅ functions test completed');
    } catch (error) {
      results.functions = {
        exists: false,
        error: error instanceof Error ? error.message : String(error),
        result: null
      };
      console.log('❌ functions test failed:', error);
    }

    console.log('🎉 All tests completed');
    return json({ 
      success: true,
      results
    });
    
  } catch (error) {
    console.error('❌ Test endpoint error:', error);
    return json({
      error: 'Server-Fehler',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
};
