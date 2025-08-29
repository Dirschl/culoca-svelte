// Test script für das Rechte-System (ES Module Version)
// Führe dieses Script aus, um zu überprüfen, ob die Tabellen existieren

import { createClient } from '@supabase/supabase-js';

// Supabase-Konfiguration (ersetze mit deinen Werten)
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRightsSystem() {
  console.log('🔍 Testing Rights System...\n');

  try {
    // Test 1: Check if profile_rights table exists
    console.log('1. Testing profile_rights table...');
    try {
      const { data: profileRights, error: profileError } = await supabase
        .from('profile_rights')
        .select('count(*)')
        .limit(1);
      
      if (profileError) {
        console.log('❌ profile_rights table error:', profileError.message);
      } else {
        console.log('✅ profile_rights table exists');
      }
    } catch (error) {
      console.log('❌ profile_rights table connection error:', error.message);
    }

    // Test 2: Check if item_rights table exists
    console.log('\n2. Testing item_rights table...');
    try {
      const { data: itemRights, error: itemError } = await supabase
        .from('item_rights')
        .select('count(*)')
        .limit(1);
      
      if (itemError) {
        console.log('❌ item_rights table error:', itemError.message);
      } else {
        console.log('✅ item_rights table exists');
      }
    } catch (error) {
      console.log('❌ item_rights table connection error:', error.message);
    }

    // Test 3: Check if public_profiles view exists
    console.log('\n3. Testing public_profiles view...');
    try {
      const { data: publicProfiles, error: publicProfilesError } = await supabase
        .from('public_profiles')
        .select('count(*)')
        .limit(1);
      
      if (publicProfilesError) {
        console.log('❌ public_profiles view error:', publicProfilesError.message);
      } else {
        console.log('✅ public_profiles view exists');
      }
    } catch (error) {
      console.log('❌ public_profiles view connection error:', error.message);
    }

    // Test 4: Check if profiles table exists
    console.log('\n4. Testing profiles table...');
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('count(*)')
        .limit(1);
      
      if (profilesError) {
        console.log('❌ profiles table error:', profilesError.message);
      } else {
        console.log('✅ profiles table exists');
      }
    } catch (error) {
      console.log('❌ profiles table connection error:', error.message);
    }

    // Test 5: Check if check_item_rights function exists
    console.log('\n5. Testing check_item_rights function...');
    try {
      const { data: functionTest, error: functionError } = await supabase.rpc('check_item_rights', {
        p_item_id: '00000000-0000-0000-0000-000000000000',
        p_user_id: '00000000-0000-0000-0000-000000000000',
        p_right_type: 'download'
      });
      
      if (functionError && functionError.code === '42883') {
        console.log('❌ check_item_rights function does not exist');
      } else if (functionError) {
        console.log('❌ check_item_rights function error:', functionError.message);
      } else {
        console.log('✅ check_item_rights function exists');
      }
    } catch (error) {
      console.log('❌ check_item_rights function connection error:', error.message);
    }

    // Test 6: Check if get_user_item_rights function exists
    console.log('\n6. Testing get_user_item_rights function...');
    try {
      const { data: getRightsTest, error: getRightsError } = await supabase.rpc('get_user_item_rights', {
        p_item_id: '00000000-0000-0000-0000-000000000000',
        p_user_id: '00000000-0000-0000-0000-000000000000'
      });
      
      if (getRightsError && getRightsError.code === '42883') {
        console.log('❌ get_user_item_rights function does not exist');
      } else if (getRightsError) {
        console.log('❌ get_user_item_rights function error:', getRightsError.message);
      } else {
        console.log('✅ get_user_item_rights function exists');
      }
    } catch (error) {
      console.log('❌ get_user_item_rights function connection error:', error.message);
    }

    // Test 7: Check if items table exists and has data
    console.log('\n7. Testing items table...');
    try {
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('id, title, user_id')
        .limit(1);
      
      if (itemsError) {
        console.log('❌ items table error:', itemsError.message);
      } else {
        console.log('✅ items table exists');
        console.log('   Sample item:', items?.[0] ? `${items[0].title} (${items[0].id})` : 'No items found');
      }
    } catch (error) {
      console.log('❌ items table connection error:', error.message);
    }

    // Test 8: Test foreign key relationships
    console.log('\n8. Testing foreign key relationships...');
    try {
      // Test if we can query item_rights with a join
      const { data: relationshipTest, error: relationshipError } = await supabase
        .from('item_rights')
        .select(`
          id,
          target_user_id,
          profiles!item_rights_target_user_id_fkey (
            id,
            full_name
          )
        `)
        .limit(1);
      
      if (relationshipError) {
        console.log('❌ Foreign key relationship error:', relationshipError.message);
      } else {
        console.log('✅ Foreign key relationships work');
      }
    } catch (error) {
      console.log('❌ Foreign key relationship connection error:', error.message);
    }

    console.log('\n🎯 Summary:');
    console.log('- If you see ❌ errors, run the database migrations');
    console.log('- If you see ✅ success, the system is ready');
    console.log('\nTo run migrations:');
    console.log('1. Copy database-migrations/apply-rights-migration.sql');
    console.log('2. Copy database-migrations/fix-item-rights-relationships.sql');
    console.log('3. Execute both in your Supabase Dashboard SQL Editor');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testRightsSystem();
