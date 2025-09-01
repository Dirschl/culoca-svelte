// Debug script für das vereinte Rechtssystem
// Untersucht warum Profile- und Item-Rechte nicht funktionieren

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

async function debugUnifiedRights() {
  console.log('🔍 Debugging Unified Rights System...\n');

  try {
    // Get sample data
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
    
    console.log(`Item: ${item.title} (Owner: ${owner?.full_name})`);
    console.log(`Other User: ${otherUser?.full_name}`);

    // Test 1: Check if profile_rights table has the right structure
    console.log('\n1. Checking profile_rights table structure...');
    try {
      const { data: profileRightsSample, error: profileRightsError } = await supabase
        .from('profile_rights')
        .select('*')
        .limit(1);
      
      if (profileRightsError) {
        console.log('❌ Error accessing profile_rights:', profileRightsError.message);
      } else {
        console.log('✅ profile_rights table accessible');
        if (profileRightsSample && profileRightsSample.length > 0) {
          console.log('Sample record:', profileRightsSample[0]);
        }
      }
    } catch (error) {
      console.log('❌ Exception accessing profile_rights:', error.message);
    }

    // Test 2: Check if item_rights table has the right structure
    console.log('\n2. Checking item_rights table structure...');
    try {
      const { data: itemRightsSample, error: itemRightsError } = await supabase
        .from('item_rights')
        .select('*')
        .limit(1);
      
      if (itemRightsError) {
        console.log('❌ Error accessing item_rights:', itemRightsError.message);
      } else {
        console.log('✅ item_rights table accessible');
        if (itemRightsSample && itemRightsSample.length > 0) {
          console.log('Sample record:', itemRightsSample[0]);
        }
      }
    } catch (error) {
      console.log('❌ Exception accessing item_rights:', error.message);
    }

    // Test 3: Create a profile right and check it directly
    console.log('\n3. Testing profile rights creation and retrieval...');
    try {
      // Create profile right
      const { data: profileRight, error: createError } = await supabase
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
        console.log('✅ Created profile right:', profileRight);
        
        // Check if we can retrieve it
        const { data: retrievedRight, error: retrieveError } = await supabase
          .from('profile_rights')
          .select('*')
          .eq('profile_id', item.user_id)
          .eq('target_user_id', otherUser.id)
          .single();
        
        if (retrieveError) {
          console.log('❌ Error retrieving profile right:', retrieveError.message);
        } else {
          console.log('✅ Retrieved profile right:', retrievedRight);
        }
        
        // Clean up
        await supabase
          .from('profile_rights')
          .delete()
          .eq('id', profileRight.id);
        console.log('✅ Cleaned up profile right');
      }
    } catch (error) {
      console.log('❌ Exception in profile rights test:', error.message);
    }

    // Test 4: Test the unified function step by step
    console.log('\n4. Testing unified function step by step...');
    try {
      // Create a profile right first
      const { data: profileRight, error: createError } = await supabase
        .from('profile_rights')
        .insert({
          profile_id: item.user_id,
          target_user_id: otherUser.id,
          rights: { download: true, download_original: false, edit: true, delete: false }
        })
        .select()
        .single();
      
      if (createError) {
        console.log('❌ Could not create profile right for testing:', createError.message);
      } else {
        console.log('✅ Created test profile right');
        
        // Test the unified function
        const { data: unifiedRights, error: unifiedError } = await supabase
          .rpc('get_unified_item_rights', {
            p_item_id: item.id,
            p_user_id: otherUser.id
          });
        
        if (unifiedError) {
          console.log('❌ Error calling unified function:', unifiedError.message);
        } else {
          console.log('✅ Unified function result:', unifiedRights);
          
          // Check what the function should return
          console.log('Expected: download=true, edit=true, download_original=false, delete=false');
          console.log('Actual:', unifiedRights);
        }
        
        // Clean up
        await supabase
          .from('profile_rights')
          .delete()
          .eq('id', profileRight.id);
        console.log('✅ Cleaned up test profile right');
      }
    } catch (error) {
      console.log('❌ Exception in unified function test:', error.message);
    }

    // Test 5: Check if the function exists
    console.log('\n5. Checking if function exists...');
    try {
      const { data: functions, error: functionsError } = await supabase
        .rpc('get_unified_item_rights', {
          p_item_id: '00000000-0000-0000-0000-000000000000',
          p_user_id: '00000000-0000-0000-0000-000000000000'
        });
      
      if (functionsError) {
        console.log('❌ Function error (expected for invalid UUIDs):', functionsError.message);
        console.log('✅ Function exists but returns error for invalid input (expected)');
      } else {
        console.log('✅ Function exists and returns:', functions);
      }
    } catch (error) {
      console.log('❌ Exception calling function:', error.message);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug
debugUnifiedRights();
