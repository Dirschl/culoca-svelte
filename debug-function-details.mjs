// Debug the function with exact data
// Testet die Funktion mit exakten Daten

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

async function debugFunctionDetails() {
  console.log('🔍 Debugging Function with Exact Data...\n');

  try {
    // Use the exact same data from the previous test
    const itemId = 'f205fe4a-194c-4ea8-a10f-8c56d271d9ad';
    const ownerId = '0ceb2320-0553-463b-971a-a0eef5ecdf09';
    const otherUserId = '40b53e82-05b9-44f9-85a0-e354e38a9fa4';
    
    console.log(`Item ID: ${itemId}`);
    console.log(`Owner ID: ${ownerId}`);
    console.log(`Other User ID: ${otherUserId}`);

    // Step 1: Check if the function exists and what it returns for owner
    console.log('\n1. Testing owner rights...');
    const { data: ownerRights, error: ownerError } = await supabase
      .rpc('get_unified_item_rights', {
        p_item_id: itemId,
        p_user_id: ownerId
      });
    
    if (ownerError) {
      console.log('❌ Owner rights error:', ownerError.message);
    } else {
      console.log('✅ Owner rights:', ownerRights);
    }

    // Step 2: Test non-owner rights (should be role permissions only)
    console.log('\n2. Testing non-owner rights (role permissions only)...');
    const { data: nonOwnerRights, error: nonOwnerError } = await supabase
      .rpc('get_unified_item_rights', {
        p_item_id: itemId,
        p_user_id: otherUserId
      });
    
    if (nonOwnerError) {
      console.log('❌ Non-owner rights error:', nonOwnerError.message);
    } else {
      console.log('✅ Non-owner rights (role only):', nonOwnerRights);
    }

    // Step 3: Create a profile right with exact data
    console.log('\n3. Creating profile right with exact data...');
    
    // First, delete any existing rights
    await supabase
      .from('profile_rights')
      .delete()
      .eq('profile_id', ownerId)
      .eq('target_user_id', otherUserId);
    
    // Create new profile right with exact data
    const { data: newProfileRight, error: createError } = await supabase
      .from('profile_rights')
      .insert({
        profile_id: ownerId,
        target_user_id: otherUserId,
        rights: { download: true, download_original: false, edit: true, delete: false }
      })
      .select()
      .single();
    
    if (createError) {
      console.log('❌ Error creating profile right:', createError.message);
      return;
    } else {
      console.log('✅ Created profile right:', newProfileRight);
    }

    // Step 4: Test function immediately after creating profile right
    console.log('\n4. Testing function immediately after creating profile right...');
    const { data: profileRights, error: profileError } = await supabase
      .rpc('get_unified_item_rights', {
        p_item_id: itemId,
        p_user_id: otherUserId
      });
    
    if (profileError) {
      console.log('❌ Profile rights error:', profileError.message);
    } else {
      console.log('✅ Function result with profile right:', profileRights);
      
      // Check what we expect
      const expected = { download: true, download_original: false, edit: true, delete: false };
      const matches = JSON.stringify(profileRights) === JSON.stringify(expected);
      console.log(`Expected: ${JSON.stringify(expected)}`);
      console.log(`Actual:   ${JSON.stringify(profileRights)}`);
      console.log(`Matches:  ${matches ? '✅' : '❌'}`);
    }

    // Step 5: Test direct SQL queries to see what the function should find
    console.log('\n5. Testing direct SQL queries...');
    
    // Check if profile right exists
    const { data: directProfileRight, error: directProfileError } = await supabase
      .from('profile_rights')
      .select('*')
      .eq('profile_id', ownerId)
      .eq('target_user_id', otherUserId)
      .single();
    
    if (directProfileError) {
      console.log('❌ Direct profile right query error:', directProfileError.message);
    } else {
      console.log('✅ Direct profile right query result:', directProfileRight);
    }
    
    // Check user's role
    const { data: userRole, error: userRoleError } = await supabase
      .from('profiles')
      .select('role_id')
      .eq('id', otherUserId)
      .single();
    
    if (userRoleError) {
      console.log('❌ User role query error:', userRoleError.message);
    } else {
      console.log('✅ User role:', userRole);
    }
    
    // Check role permissions
    if (userRole) {
      const { data: rolePermissions, error: roleError } = await supabase
        .from('roles')
        .select('permissions')
        .eq('id', userRole.role_id)
        .single();
      
      if (roleError) {
        console.log('❌ Role permissions query error:', roleError.message);
      } else {
        console.log('✅ Role permissions:', rolePermissions);
      }
    }

    // Step 6: Test the function with raw SQL to see what's happening
    console.log('\n6. Testing function with raw SQL...');
    try {
      const { data: rawResult, error: rawError } = await supabase
        .rpc('get_unified_item_rights', {
          p_item_id: itemId,
          p_user_id: otherUserId
        });
      
      if (rawError) {
        console.log('❌ Raw function error:', rawError.message);
      } else {
        console.log('✅ Raw function result:', rawResult);
      }
    } catch (error) {
      console.log('❌ Exception calling function:', error.message);
    }

    // Clean up
    console.log('\n7. Cleaning up...');
    await supabase
      .from('profile_rights')
      .delete()
      .eq('id', newProfileRight.id);
    console.log('✅ Cleaned up profile right');

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug
debugFunctionDetails();
