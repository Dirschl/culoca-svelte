// Debug the role info function
// Testet die get_user_role_info Funktion

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

async function debugRoleInfo() {
  console.log('🔍 Debugging Role Info Function...\n');

  try {
    // Get a user to test with
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, role_id')
      .limit(1);
    
    if (profilesError || !profiles || profiles.length === 0) {
      console.log('❌ No profiles found');
      return;
    }
    
    const user = profiles[0];
    console.log(`Testing with user: ${user.full_name} (ID: ${user.id}, Role ID: ${user.role_id})`);

    // Test 1: Check if get_user_role_info function exists
    console.log('\n1. Testing get_user_role_info function...');
    try {
      const { data: roleInfo, error: roleError } = await supabase
        .rpc('get_user_role_info', {
          user_id: user.id
        });
      
      if (roleError) {
        console.log('❌ Role info function error:', roleError.message);
      } else {
        console.log('✅ Role info function result:', roleInfo);
      }
    } catch (error) {
      console.log('❌ Exception calling role info function:', error.message);
    }

    // Test 2: Check if we can query the user's role directly
    console.log('\n2. Testing direct role query...');
    const { data: directRole, error: directRoleError } = await supabase
      .from('profiles')
      .select('role_id')
      .eq('id', user.id)
      .single();
    
    if (directRoleError) {
      console.log('❌ Direct role query error:', directRoleError.message);
    } else {
      console.log('✅ Direct role query result:', directRole);
    }

    // Test 3: Check if we can query the role details
    if (directRole) {
      console.log('\n3. Testing role details query...');
      const { data: roleDetails, error: roleDetailsError } = await supabase
        .from('roles')
        .select('*')
        .eq('id', directRole.role_id)
        .single();
      
      if (roleDetailsError) {
        console.log('❌ Role details query error:', roleDetailsError.message);
      } else {
        console.log('✅ Role details query result:', roleDetails);
      }
    }

    // Test 4: Check if the function exists in the database
    console.log('\n4. Testing if function exists...');
    try {
      const { data: functionTest, error: functionError } = await supabase
        .rpc('get_user_role_info', {
          user_id: '00000000-0000-0000-0000-000000000000'
        });
      
      if (functionError) {
        console.log('❌ Function error (expected for invalid UUID):', functionError.message);
        console.log('✅ Function exists but returns error for invalid input (expected)');
      } else {
        console.log('✅ Function exists and returns:', functionTest);
      }
    } catch (error) {
      console.log('❌ Exception calling function:', error.message);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug
debugRoleInfo();
