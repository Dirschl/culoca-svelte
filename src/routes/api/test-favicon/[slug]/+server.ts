import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export const GET = async ({ params }) => {
  const { slug } = params;

  console.log('🔍 Test Favicon API called with slug:', slug);

  try {
    // 1. Hole das Item aus der DB
    const { data: item, error: dbError } = await supabase
      .from('items')
      .select('id, path_64, path_512, title, original_name, slug')
      .eq('slug', slug)
      .single();

    console.log('🔍 Database query result:', { item, dbError });

    if (dbError || !item) {
      return json({ 
        error: 'Item not found', 
        slug, 
        dbError: dbError?.message,
        availableSlugs: [] // We'll add this later if needed
      });
    }

    // 2. Prüfe Bild-Pfade
    const imagePaths = {
      path_64: item.path_64,
      path_512: item.path_512,
      has_64: !!item.path_64,
      has_512: !!item.path_512
    };

    // 3. Generiere URLs
    const baseUrl = 'https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public';
    const urls = {
      url_64: item.path_64 ? `${baseUrl}/images-64/${item.path_64}` : null,
      url_512: item.path_512 ? `${baseUrl}/images-512/${item.path_512}` : null
    };

    return json({
      success: true,
      item: {
        id: item.id,
        title: item.title,
        original_name: item.original_name,
        slug: item.slug
      },
      imagePaths,
      urls,
      testUrl: item.path_64 ? urls.url_64 : urls.url_512
    });

  } catch (err) {
    console.error('Test favicon error:', err);
    return json({ 
      error: 'Unexpected error', 
      message: err.message,
      slug 
    });
  }
}; 