import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export async function POST() {
  try {
    console.log('🧪 Testing map functions...');

    // Test the main function
    const { data: mainData, error: mainError } = await supabase.rpc('map_images_postgis', {
      user_lat: 0,
      user_lon: 0,
      current_user_id: null,
      user_filter_id: null,
      location_filter_lat: null,
      location_filter_lon: null
    });

    if (mainError) {
      console.error('Main function error:', mainError);
      
      // Try the simple function
      const { data: simpleData, error: simpleError } = await supabase.rpc('map_images_postgis_simple', {
        user_lat: 0,
        user_lon: 0,
        current_user_id: null
      });

      if (simpleError) {
        console.error('Simple function error:', simpleError);
        return json({ 
          success: false, 
          error: 'Both functions failed',
          details: {
            mainFunctionError: mainError,
            simpleFunctionError: simpleError
          }
        }, { status: 500 });
      } else {
        console.log('Simple function works!');
        return json({ 
          success: true, 
          message: 'Simple function available',
          simpleFunctionWorks: true,
          mainFunctionWorks: false,
          testCount: simpleData?.length || 0
        });
      }
    } else {
      console.log('Main function works!');
      return json({ 
        success: true, 
        message: 'Main function works',
        mainFunctionWorks: true,
        simpleFunctionWorks: true,
        testCount: mainData?.length || 0
      });
    }

  } catch (error) {
    console.error('Test error:', error);
    return json({ 
      success: false, 
      error: 'Test failed',
      details: error
    }, { status: 500 });
  }
}; 