import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export async function POST() {
  try {
    console.log('🔧 Checking database schema...');
    
    // First, let's check what columns exist in the items table
    const { data: schemaData, error: schemaError } = await supabase
      .from('items')
      .select('*')
      .limit(1);
    
    if (schemaError) {
      console.error('❌ Schema check failed:', schemaError);
      return json({ success: false, error: schemaError.message });
    }
    
    console.log('📋 Available columns:', Object.keys(schemaData?.[0] || {}));
    
    // Test the current function to see what error we get
    console.log('🧪 Testing current function...');
    const { data: testData, error: testError } = await supabase.rpc('images_by_distance', {
      user_lat: 48.2803194333333,
      user_lon: 12.6086833333333,
      page: 0,
      page_size: 5
    });
    
    if (testError) {
      console.error('❌ Current function error:', testError);
      
      // Try a simple query to see what works
      console.log('🔍 Trying simple query...');
      const { data: simpleData, error: simpleError } = await supabase
        .from('items')
        .select('id, path_512, lat, lon, title')
        .not('lat', 'is', null)
        .not('lon', 'is', null)
        .not('path_512', 'is', null)
        .limit(5);
      
      if (simpleError) {
        console.error('❌ Simple query failed:', simpleError);
        return json({ success: false, error: simpleError.message });
      }
      
      console.log('✅ Simple query works:', simpleData?.length || 0, 'items');
      
      return json({ 
        success: false, 
        error: testError.message,
        schemaColumns: Object.keys(schemaData?.[0] || {}),
        simpleQueryWorks: true,
        simpleQueryCount: simpleData?.length || 0
      });
    }
    
    console.log('✅ Function works!');
    console.log('📊 Test result:', testData?.length || 0, 'images returned');
    
    if (testData && testData.length > 0) {
      console.log('📍 First image distance:', testData[0].distance);
      console.log('📍 First image:', testData[0].id, testData[0].title);
    }
    
    return json({ 
      success: true, 
      testCount: testData?.length || 0,
      firstDistance: testData?.[0]?.distance || null,
      firstImage: testData?.[0] || null,
      schemaColumns: Object.keys(schemaData?.[0] || {})
    });
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return json({ success: false, error: error.message });
  }
} 