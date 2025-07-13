import type { PageServerLoad } from './$types';
import { supabase } from '$lib/supabaseClient';

export const load: PageServerLoad = async ({ params }) => {
  const { id } = params;
  
  try {
    // Fetch image data server-side
    const { data: image, error } = await supabase
      .from('items')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return {
        image: null,
        error: error.message
      };
    }

    return {
      image,
      error: null
    };
  } catch (err) {
    return {
      image: null,
      error: 'Failed to load image'
    };
  }
}; 