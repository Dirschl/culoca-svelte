// Test the function with current user and item
// Testet die Funktion mit dem aktuellen Benutzer und Item aus dem Browser

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

async function testCurrentUserItem() {
  console.log('🔍 Testing Function with Current User and Item...\n');

  try {
    // Use the exact data from the browser
    const itemId = '0c83c624-16d2-4bdc-949a-e49947a886e2';
    const currentUserId = '0f5e03d8-79f0-4d1e-b70c-f5bf750de59d';
    
    console.log(`Item ID: ${itemId}`);
    console.log(`Current User ID: ${currentUserId}`);

    // Step 1: Get item owner
    console.log('\n1. Getting item owner...');
    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('id, user_id')
      .eq('id', itemId)
      .single();
    
    if (itemError || !item) {
      console.log('❌ Item not found:', itemError?.message);
      return;
    }
    
    const ownerId = item.user_id;
    console.log(`Item owner: ${ownerId}`);

    // Step 2: Check if current user is owner
    const isOwner = currentUserId === ownerId;
    console.log(`Is current user owner: ${isOwner}`);

    // Step 3: Test the function with current user
    console.log('\n2. Testing function with current user...');
    const { data: functionResult, error: functionError } = await supabase
      .rpc('get_unified_item_rights', {
        p_item_id: itemId,
        p_user_id: currentUserId
      });
    
    if (functionError) {
      console.log('❌ Function error:', functionError.message);
    } else {
      console.log('✅ Function result:', functionResult);
    }

    // Step 4: Check if there are any profile rights for this user
    console.log('\n3. Checking existing profile rights...');
    const { data: existingProfileRights, error: profileError } = await supabase
      .from('profile_rights')
      .select('*')
      .eq('target_user_id', currentUserId);
    
    if (profileError) {
      console.log('❌ Profile rights query error:', profileError.message);
    } else {
      console.log(`Found ${existingProfileRights?.length || 0} profile rights for current user`);
      if (existingProfileRights && existingProfileRights.length > 0) {
        console.log('Existing profile rights:', existingProfileRights);
      }
    }

    // Step 5: Check if there are any profile rights from the item owner
    console.log('\n4. Checking profile rights from item owner...');
    const { data: ownerProfileRights, error: ownerProfileError } = await supabase
      .from('profile_rights')
      .select('*')
      .eq('profile_id', ownerId)
      .eq('target_user_id', currentUserId);
    
    if (ownerProfileError) {
      console.log('❌ Owner profile rights query error:', ownerProfileError.message);
    } else {
      console.log(`Found ${ownerProfileRights?.length || 0} profile rights from item owner`);
      if (ownerProfileRights && ownerProfileRights.length > 0) {
        console.log('Owner profile rights:', ownerProfileRights);
      }
    }

    // Step 6: Create a test profile right if none exist
    if (!ownerProfileRights || ownerProfileRights.length === 0) {
      console.log('\n5. Creating test profile right...');
      
      const { data: newProfileRight, error: createError } = await supabase
        .from('profile_rights')
        .insert({
          profile_id: ownerId,
          target_user_id: currentUserId,
          rights: { download: true, download_original: false, edit: true, delete: false }
        })
        .select()
        .single();
      
      if (createError) {
        console.log('❌ Error creating profile right:', createError.message);
      } else {
        console.log('✅ Created test profile right:', newProfileRight);
        
        // Test the function again
        console.log('\n6. Testing function after creating profile right...');
        const { data: newFunctionResult, error: newFunctionError } = await supabase
          .rpc('get_unified_item_rights', {
            p_item_id: itemId,
            p_user_id: currentUserId
          });
        
        if (newFunctionError) {
          console.log('❌ New function error:', newFunctionError.message);
        } else {
          console.log('✅ New function result:', newFunctionResult);
          
          // Check what we expect
          const expected = { download: true, download_original: false, edit: true, delete: false };
          const matches = JSON.stringify(newFunctionResult) === JSON.stringify(expected);
          console.log(`Expected: ${JSON.stringify(expected)}`);
          console.log(`Actual:   ${JSON.stringify(newFunctionResult)}`);
          console.log(`Matches:  ${matches ? '✅' : '❌'}`);
        }
        
        // Clean up
        console.log('\n7. Cleaning up test profile right...');
        await supabase
          .from('profile_rights')
          .delete()
          .eq('id', newProfileRight.id);
        console.log('✅ Cleaned up test profile right');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testCurrentUserItem();
