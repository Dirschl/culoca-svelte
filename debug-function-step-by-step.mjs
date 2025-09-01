// Debug the function step by step
// Testet die Funktion Schritt für Schritt

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

async function debugStepByStep() {
  console.log('🔍 Debugging Function Step by Step...\n');

  try {
    // Get test data
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('id, title, user_id')
      .limit(1);
    
    if (itemsError || !items || items.length === 0) {
      console.log('❌ No items found');
      return;
    }
    
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, role_id')
      .limit(2);
    
    if (profilesError || !profiles || profiles.length < 2) {
      console.log('❌ Need at least 2 profiles');
      return;
    }
    
    const item = items[0];
    const owner = profiles.find(p => p.id === item.user_id);
    const otherUser = profiles.find(p => p.id !== item.user_id);
    
    console.log(`Item: ${item.title} (ID: ${item.id})`);
    console.log(`Owner: ${owner?.full_name} (ID: ${item.user_id})`);
    console.log(`Other User: ${otherUser?.full_name} (ID: ${otherUser?.id})`);

    // Step 1: Test owner rights
    console.log('\n1. Testing owner rights...');
    const { data: ownerRights, error: ownerError } = await supabase
      .rpc('get_unified_item_rights', {
        p_item_id: item.id,
        p_user_id: item.user_id
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
        p_item_id: item.id,
        p_user_id: otherUser.id
      });
    
    if (nonOwnerError) {
      console.log('❌ Non-owner rights error:', nonOwnerError.message);
    } else {
      console.log('✅ Non-owner rights (role only):', nonOwnerRights);
    }

    // Step 3: Create a profile right and test
    console.log('\n3. Creating profile right...');
    
    // First, delete any existing rights
    await supabase
      .from('profile_rights')
      .delete()
      .eq('profile_id', item.user_id)
      .eq('target_user_id', otherUser.id);
    
    // Create new profile right
    const { data: newProfileRight, error: createError } = await supabase
      .from('profile_rights')
      .insert({
        profile_id: item.user_id,
        target_user_id: otherUser.id,
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

    // Step 4: Test function with profile right
    console.log('\n4. Testing function with profile right...');
    const { data: profileRights, error: profileError } = await supabase
      .rpc('get_unified_item_rights', {
        p_item_id: item.id,
        p_user_id: otherUser.id
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

    // Step 5: Test direct queries to see what the function should find
    console.log('\n5. Testing direct queries...');
    
    // Check if profile right exists
    const { data: directProfileRight, error: directProfileError } = await supabase
      .from('profile_rights')
      .select('*')
      .eq('profile_id', item.user_id)
      .eq('target_user_id', otherUser.id)
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
      .eq('id', otherUser.id)
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

    // Clean up
    console.log('\n6. Cleaning up...');
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
debugStepByStep();
