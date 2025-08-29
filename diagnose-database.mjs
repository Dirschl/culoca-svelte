// Diagnose Database Script
// This script checks what exists in the database and identifies problems

import { createClient } from '@supabase/supabase-js';

// Supabase-Konfiguration (ersetze mit deinen Werten)
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseDatabase() {
  console.log('🔍 Diagnosing Database...\n');

  try {
    // Check 1: List all tables
    console.log('1. Checking all tables...');
    try {
      const { data: tables, error: tablesError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .order('table_name');
      
      if (tablesError) {
        console.log('❌ Could not list tables:', tablesError.message);
      } else {
        console.log('✅ Tables found:');
        tables?.forEach(table => {
          console.log(`   - ${table.table_name}`);
        });
      }
    } catch (error) {
      console.log('❌ Error listing tables:', error.message);
    }

    // Check 2: Check if item_rights table exists and its structure
    console.log('\n2. Checking item_rights table...');
    try {
      const { data: itemRights, error: itemRightsError } = await supabase
        .from('item_rights')
        .select('*')
        .limit(1);
      
      if (itemRightsError) {
        console.log('❌ item_rights table error:', itemRightsError.message);
        
        // Try to get table structure
        try {
          const { data: columns, error: columnsError } = await supabase
            .from('information_schema.columns')
            .select('column_name, data_type')
            .eq('table_name', 'item_rights')
            .eq('table_schema', 'public');
          
          if (columnsError) {
            console.log('❌ Could not get table structure:', columnsError.message);
          } else {
            console.log('📋 item_rights table structure:');
            columns?.forEach(col => {
              console.log(`   - ${col.column_name}: ${col.data_type}`);
            });
          }
        } catch (error) {
          console.log('❌ Error getting table structure:', error.message);
        }
      } else {
        console.log('✅ item_rights table exists and is accessible');
        if (itemRights && itemRights.length > 0) {
          console.log('📋 Sample record structure:');
          Object.keys(itemRights[0]).forEach(key => {
            console.log(`   - ${key}: ${typeof itemRights[0][key]}`);
          });
        }
      }
    } catch (error) {
      console.log('❌ Error checking item_rights:', error.message);
    }

    // Check 3: Check if profile_rights table exists and its structure
    console.log('\n3. Checking profile_rights table...');
    try {
      const { data: profileRights, error: profileRightsError } = await supabase
        .from('profile_rights')
        .select('*')
        .limit(1);
      
      if (profileRightsError) {
        console.log('❌ profile_rights table error:', profileRightsError.message);
        
        // Try to get table structure
        try {
          const { data: columns, error: columnsError } = await supabase
            .from('information_schema.columns')
            .select('column_name, data_type')
            .eq('table_name', 'profile_rights')
            .eq('table_schema', 'public');
          
          if (columnsError) {
            console.log('❌ Could not get table structure:', columnsError.message);
          } else {
            console.log('📋 profile_rights table structure:');
            columns?.forEach(col => {
              console.log(`   - ${col.column_name}: ${col.data_type}`);
            });
          }
        } catch (error) {
          console.log('❌ Error getting table structure:', error.message);
        }
      } else {
        console.log('✅ profile_rights table exists and is accessible');
        if (profileRights && profileRights.length > 0) {
          console.log('📋 Sample record structure:');
          Object.keys(profileRights[0]).forEach(key => {
            console.log(`   - ${key}: ${typeof profileRights[0][key]}`);
          });
        }
      }
    } catch (error) {
      console.log('❌ Error checking profile_rights:', error.message);
    }

    // Check 4: Check if items table exists
    console.log('\n4. Checking items table...');
    try {
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('id, title, user_id')
        .limit(1);
      
      if (itemsError) {
        console.log('❌ items table error:', itemsError.message);
      } else {
        console.log('✅ items table exists and is accessible');
        console.log(`   Sample item: ${items?.[0] ? items[0].title : 'No items found'}`);
      }
    } catch (error) {
      console.log('❌ Error checking items:', error.message);
    }

    // Check 5: Check if profiles table exists
    console.log('\n5. Checking profiles table...');
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .limit(1);
      
      if (profilesError) {
        console.log('❌ profiles table error:', profilesError.message);
      } else {
        console.log('✅ profiles table exists and is accessible');
        console.log(`   Sample profile: ${profiles?.[0] ? profiles[0].full_name : 'No profiles found'}`);
      }
    } catch (error) {
      console.log('❌ Error checking profiles:', error.message);
    }

    // Check 6: Check if public_profiles view exists
    console.log('\n6. Checking public_profiles view...');
    try {
      const { data: publicProfiles, error: publicProfilesError } = await supabase
        .from('public_profiles')
        .select('id, full_name, email')
        .limit(1);
      
      if (publicProfilesError) {
        console.log('❌ public_profiles view error:', publicProfilesError.message);
      } else {
        console.log('✅ public_profiles view exists and is accessible');
        console.log(`   Sample profile: ${publicProfiles?.[0] ? publicProfiles[0].full_name : 'No profiles found'}`);
      }
    } catch (error) {
      console.log('❌ Error checking public_profiles:', error.message);
    }

    console.log('\n🎯 Diagnosis Summary:');
    console.log('- Check the output above to see what exists and what is missing');
    console.log('- If tables don\'t exist, use database-migrations/complete-rights-migration.sql');
    console.log('- If tables exist but have wrong structure, use database-migrations/safe-rights-migration.sql');

  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
  }
}

// Run the diagnosis
diagnoseDatabase();
