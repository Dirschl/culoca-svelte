// Simple debug script für das vereinte Rechtssystem
// Testet die Funktion mit spezifischen Testfällen

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

async function debugSimple() {
  console.log('🔍 Simple Debug Test...\n');

  try {
    // Get one item and two users
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
    
    console.log(`Item: ${item.title}`);
    console.log(`Owner: ${owner?.full_name} (${item.user_id})`);
    console.log(`Other User: ${otherUser?.full_name} (${otherUser?.id})`);

    // Test 1: Check if there are any existing profile rights
    console.log('\n1. Checking existing profile rights...');
    const { data: existingProfileRights, error: existingProfileError } = await supabase
      .from('profile_rights')
      .select('*')
      .eq('profile_id', item.user_id)
      .eq('target_user_id', otherUser.id);
    
    if (existingProfileError) {
      console.log('❌ Error checking existing profile rights:', existingProfileError.message);
    } else {
      console.log(`Found ${existingProfileRights?.length || 0} existing profile rights`);
      if (existingProfileRights && existingProfileRights.length > 0) {
        console.log('Existing rights:', existingProfileRights[0]);
      }
    }

    // Test 2: Create a profile right and test immediately
    console.log('\n2. Creating and testing profile right...');
    
    // First, delete any existing rights to start clean
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
    } else {
      console.log('✅ Created profile right:', newProfileRight);
      
      // Test the unified function immediately
      const { data: unifiedRights, error: unifiedError } = await supabase
        .rpc('get_unified_item_rights', {
          p_item_id: item.id,
          p_user_id: otherUser.id
        });
      
      if (unifiedError) {
        console.log('❌ Error calling unified function:', unifiedError.message);
      } else {
        console.log('✅ Unified function result:', unifiedRights);
        
        // Check if it matches what we expect
        const expected = { download: true, download_original: false, edit: true, delete: false };
        const matches = JSON.stringify(unifiedRights) === JSON.stringify(expected);
        console.log(`Expected: ${JSON.stringify(expected)}`);
        console.log(`Actual:   ${JSON.stringify(unifiedRights)}`);
        console.log(`Matches:  ${matches ? '✅' : '❌'}`);
      }
      
      // Clean up
      await supabase
        .from('profile_rights')
        .delete()
        .eq('id', newProfileRight.id);
      console.log('✅ Cleaned up profile right');
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug
debugSimple();
