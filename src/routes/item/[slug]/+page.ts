import type { PageLoad } from './$types';

export const load: PageLoad = async ({ data, url }) => {
  const image = data?.image;
  
  if (image) {
    // Add SEO meta tags to prevent Google from "stealing" nearby image titles/descriptions
    const metaTags = {
      title: image.title || image.original_name || 'Bild',
      description: image.description || image.caption || `Bild von ${image.title || image.original_name || 'unbekannt'}`,
      image: `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${image.path_2048 || image.path_512}`,
      imageAlt: image.description || image.caption || `Bild von ${image.title || image.original_name || 'unbekannt'}`,
      url: url.toString(),
      author: image.full_name || 'Johann Dirschl',
      publishedTime: image.created_at || '',
      width: image.width || 0,
      height: image.height || 0
    };

    return {
      ...data,
      metaTags
    };
  }

  return data;
};
