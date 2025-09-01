// Test the function directly with exact data
// Testet die Funktion direkt mit exakten Daten

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

async function testFunctionDirect() {
  console.log('🔍 Testing Function Directly...\n');

  try {
    // Use the exact same data from the previous test
    const itemId = 'f205fe4a-194c-4ea8-a10f-8c56d271d9ad';
    const ownerId = '0ceb2320-0553-463b-971a-a0eef5ecdf09';
    const otherUserId = '40b53e82-05b9-44f9-85a0-e354e38a9fa4';
    
    console.log(`Item ID: ${itemId}`);
    console.log(`Owner ID: ${ownerId}`);
    console.log(`Other User ID: ${otherUserId}`);

    // Step 1: Create a profile right
    console.log('\n1. Creating profile right...');
    
    // First, delete any existing rights
    await supabase
      .from('profile_rights')
      .delete()
      .eq('profile_id', ownerId)
      .eq('target_user_id', otherUserId);
    
    // Create new profile right
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

    // Step 2: Test the function directly
    console.log('\n2. Testing function directly...');
    const { data: functionResult, error: functionError } = await supabase
      .rpc('get_unified_item_rights', {
        p_item_id: itemId,
        p_user_id: otherUserId
      });
    
    if (functionError) {
      console.log('❌ Function error:', functionError.message);
    } else {
      console.log('✅ Function result:', functionResult);
      
      // Check what we expect
      const expected = { download: true, download_original: false, edit: true, delete: false };
      const matches = JSON.stringify(functionResult) === JSON.stringify(expected);
      console.log(`Expected: ${JSON.stringify(expected)}`);
      console.log(`Actual:   ${JSON.stringify(functionResult)}`);
      console.log(`Matches:  ${matches ? '✅' : '❌'}`);
    }

    // Step 3: Test with owner
    console.log('\n3. Testing with owner...');
    const { data: ownerResult, error: ownerError } = await supabase
      .rpc('get_unified_item_rights', {
        p_item_id: itemId,
        p_user_id: ownerId
      });
    
    if (ownerError) {
      console.log('❌ Owner function error:', ownerError.message);
    } else {
      console.log('✅ Owner function result:', ownerResult);
    }

    // Clean up
    console.log('\n4. Cleaning up...');
    await supabase
      .from('profile_rights')
      .delete()
      .eq('id', newProfileRight.id);
    console.log('✅ Cleaned up profile right');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testFunctionDirect();
