// Test script für das log-item-view System
// Führe dieses Script aus, um zu überprüfen, ob die item_views Tabelle und Funktionen korrekt funktionieren

import { createClient } from '@supabase/supabase-js';

// Supabase-Konfiguration (ersetze mit deinen Werten)
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLogItemView() {
  console.log('🔍 Testing Log Item View System...\n');

  try {
    // Test 1: Check if item_views table exists
    console.log('1. Testing item_views table...');
    try {
      const { data: itemViews, error: itemViewsError } = await supabase
        .from('item_views')
        .select('count(*)')
        .limit(1);
      
      if (itemViewsError) {
        console.log('❌ item_views table error:', itemViewsError.message);
      } else {
        console.log('✅ item_views table exists');
      }
    } catch (error) {
      console.log('❌ item_views table connection error:', error.message);
    }

    // Test 2: Check if log_item_view function exists
    console.log('\n2. Testing log_item_view function...');
    try {
      const { data: functionTest, error: functionError } = await supabase.rpc('log_item_view', {
        p_item_id: '00000000-0000-0000-0000-000000000000',
        p_visitor_id: null,
        p_referer: 'test',
        p_user_agent: 'test',
        p_ip_address: '127.0.0.1',
        p_visitor_lat: null,
        p_visitor_lon: null
      });
      
      if (functionError && functionError.code === '42883') {
        console.log('❌ log_item_view function does not exist');
      } else if (functionError) {
        console.log('❌ log_item_view function error:', functionError.message);
      } else {
        console.log('✅ log_item_view function exists and works');
      }
    } catch (error) {
      console.log('❌ log_item_view function connection error:', error.message);
    }

    // Test 3: Check if log_item_view_basic function exists
    console.log('\n3. Testing log_item_view_basic function...');
    try {
      const { data: basicFunctionTest, error: basicFunctionError } = await supabase.rpc('log_item_view_basic', {
        p_item_id: '00000000-0000-0000-0000-000000000000',
        p_visitor_id: null,
        p_referer: 'test',
        p_user_agent: 'test',
        p_ip_address: '127.0.0.1'
      });
      
      if (basicFunctionError && basicFunctionError.code === '42883') {
        console.log('❌ log_item_view_basic function does not exist');
      } else if (basicFunctionError) {
        console.log('❌ log_item_view_basic function error:', basicFunctionError.message);
      } else {
        console.log('✅ log_item_view_basic function exists and works');
      }
    } catch (error) {
      console.log('❌ log_item_view_basic function connection error:', error.message);
    }

    // Test 4: Check if items table exists and has data
    console.log('\n4. Testing items table...');
    try {
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('id, title, user_id')
        .limit(1);
      
      if (itemsError) {
        console.log('❌ items table error:', itemsError.message);
      } else {
        console.log('✅ items table exists');
        console.log('   Sample item:', items?.[0] ? `${items[0].title} (${items[0].id})` : 'No items found');
      }
    } catch (error) {
      console.log('❌ items table connection error:', error.message);
    }

    // Test 5: Test direct insert into item_views
    console.log('\n5. Testing direct insert into item_views...');
    try {
      const testItemId = '00000000-0000-0000-0000-000000000000';
      
      const { data: insertData, error: insertError } = await supabase
        .from('item_views')
        .insert({
          item_id: testItemId,
          visitor_id: null,
          referer: 'test-script',
          user_agent: 'test-script',
          ip_address: '127.0.0.1',
          distance_meters: null,
          visitor_lat: null,
          visitor_lon: null
        })
        .select()
        .single();
      
      if (insertError) {
        console.log('❌ Direct insert failed:', insertError.message);
      } else {
        console.log('✅ Direct insert successful');
        console.log('   Inserted record ID:', insertData.id);
        
        // Clean up test data
        try {
          await supabase
            .from('item_views')
            .delete()
            .eq('id', insertData.id);
          console.log('   Test record cleaned up');
        } catch (cleanupError) {
          console.log('   Warning: Could not clean up test record:', cleanupError.message);
        }
      }
    } catch (error) {
      console.log('❌ Direct insert connection error:', error.message);
    }

    console.log('\n🎯 Summary:');
    console.log('- If you see ❌ errors, run the database migration');
    console.log('- If you see ✅ success, the system is ready');
    console.log('\nTo run migration, copy the content of database-migrations/fix-item-views-table.sql');
    console.log('and execute it in your Supabase Dashboard SQL Editor');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testLogItemView();
