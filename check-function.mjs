// Check the current database function state
// Untersucht die aktuelle Funktion in der Datenbank

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

async function checkFunction() {
  console.log('🔍 Checking Database Function State...\n');

  try {
    // Test 1: Check if function exists and what it returns
    console.log('1. Testing function with invalid UUIDs...');
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

    // Test 2: Check if we can query the tables directly
    console.log('\n2. Checking table access...');
    
    // Check profile_rights
    const { data: profileRightsCount, error: profileError } = await supabase
      .from('profile_rights')
      .select('*', { count: 'exact', head: true });
    
    if (profileError) {
      console.log('❌ Error accessing profile_rights:', profileError.message);
    } else {
      console.log(`✅ profile_rights accessible, count: ${profileRightsCount}`);
    }
    
    // Check item_rights
    const { data: itemRightsCount, error: itemError } = await supabase
      .from('item_rights')
      .select('*', { count: 'exact', head: true });
    
    if (itemError) {
      console.log('❌ Error accessing item_rights:', itemError.message);
    } else {
      console.log(`✅ item_rights accessible, count: ${itemRightsCount}`);
    }

    // Test 3: Check if we can query items and profiles
    console.log('\n3. Checking items and profiles...');
    
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('id, title, user_id')
      .limit(1);
    
    if (itemsError) {
      console.log('❌ Error accessing items:', itemsError.message);
    } else {
      console.log(`✅ items accessible, found: ${items?.length || 0}`);
      if (items && items.length > 0) {
        console.log('Sample item:', items[0]);
      }
    }
    
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, role_id')
      .limit(2);
    
    if (profilesError) {
      console.log('❌ Error accessing profiles:', profilesError.message);
    } else {
      console.log(`✅ profiles accessible, found: ${profiles?.length || 0}`);
      if (profiles && profiles.length > 0) {
        console.log('Sample profiles:', profiles.map(p => ({ id: p.id, name: p.full_name, role: p.role_id })));
      }
    }

    // Test 4: Check roles table
    console.log('\n4. Checking roles...');
    
    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select('*');
    
    if (rolesError) {
      console.log('❌ Error accessing roles:', rolesError.message);
    } else {
      console.log(`✅ roles accessible, found: ${roles?.length || 0}`);
      if (roles && roles.length > 0) {
        console.log('Roles:', roles.map(r => ({ id: r.id, name: r.name, permissions: r.permissions })));
      }
    }

  } catch (error) {
    console.error('❌ Check failed:', error);
  }
}

// Run the check
checkFunction();
