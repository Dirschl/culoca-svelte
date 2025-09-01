// Check the current function definition in the database
// Überprüft die aktuelle Funktionsdefinition in der Datenbank

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Lade .env Datei
config();

// Supabase-Konfiguration
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ VITE_SUPABASE_URL oder VITE_SUPABASE_ANON_KEY nicht gefunden');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCurrentFunction() {
  console.log('🔍 Checking Current Function Definition...\n');

  try {
    // Test 1: Check if the function exists and what it returns
    console.log('1. Testing function existence...');
    try {
      const { data: functionTest, error: functionError } = await supabase
        .rpc('get_unified_item_rights', {
          p_item_id: '00000000-0000-0000-0000-000000000000',
          p_user_id: '00000000-0000-0000-0000-000000000000'
        });
      
      if (functionError) {
        console.log('❌ Function error:', functionError.message);
      } else {
        console.log('✅ Function exists and returns:', functionTest);
      }
    } catch (error) {
      console.log('❌ Exception calling function:', error.message);
    }

    // Test 2: Check if we can query the function directly with SQL
    console.log('\n2. Testing function with direct SQL...');
    try {
      const { data: sqlResult, error: sqlError } = await supabase
        .from('information_schema.routines')
        .select('routine_definition')
        .eq('routine_name', 'get_unified_item_rights')
        .single();
      
      if (sqlError) {
        console.log('❌ SQL query error:', sqlError.message);
      } else {
        console.log('✅ Function definition found');
        if (sqlResult && sqlResult.routine_definition) {
          // Show first 500 characters of the function
          const definition = sqlResult.routine_definition;
          console.log('Function definition (first 500 chars):');
          console.log(definition.substring(0, 500) + '...');
          
          // Check if it contains the expected logic
          if (definition.includes('profile_rights')) {
            console.log('✅ Function contains profile_rights logic');
          } else {
            console.log('❌ Function does NOT contain profile_rights logic');
          }
          
          if (definition.includes('item_rights')) {
            console.log('✅ Function contains item_rights logic');
          } else {
            console.log('❌ Function does NOT contain item_rights logic');
          }
        }
      }
    } catch (error) {
      console.log('❌ Exception in SQL query:', error.message);
    }

    // Test 3: Check if the function was actually updated
    console.log('\n3. Testing function with a simple case...');
    try {
      // Create a simple test case
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('id, user_id')
        .limit(1);
      
      if (itemsError || !items || items.length === 0) {
        console.log('❌ No items found for testing');
        return;
      }
      
      const item = items[0];
      console.log(`Testing with item: ${item.id}, owner: ${item.user_id}`);
      
      // Test owner rights
      const { data: ownerRights, error: ownerError } = await supabase
        .rpc('get_unified_item_rights', {
          p_item_id: item.id,
          p_user_id: item.user_id
        });
      
      if (ownerError) {
        console.log('❌ Owner test error:', ownerError.message);
      } else {
        console.log('✅ Owner test result:', ownerRights);
      }
      
      // Test non-owner rights
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id')
        .neq('id', item.user_id)
        .limit(1);
      
      if (profilesError || !profiles || profiles.length === 0) {
        console.log('❌ No other profiles found for testing');
        return;
      }
      
      const otherUser = profiles[0];
      console.log(`Testing with other user: ${otherUser.id}`);
      
      const { data: nonOwnerRights, error: nonOwnerError } = await supabase
        .rpc('get_unified_item_rights', {
          p_item_id: item.id,
          p_user_id: otherUser.id
        });
      
      if (nonOwnerError) {
        console.log('❌ Non-owner test error:', nonOwnerError.message);
      } else {
        console.log('✅ Non-owner test result:', nonOwnerRights);
      }
      
    } catch (error) {
      console.log('❌ Exception in simple test:', error.message);
    }

  } catch (error) {
    console.error('❌ Check failed:', error);
  }
}

// Run the check
checkCurrentFunction();
