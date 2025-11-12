import type { PageLoad } from './$types';

export const load: PageLoad = async ({ data, url }) => {
  const image = data?.image;
  
  if (image) {
    // Add SEO meta tags to prevent Google from "stealing" nearby image titles/descriptions
    const metaTags = {
      title: image.title || image.original_name || 'Bild',
      description: image.description || image.caption || `Bild von ${image.title || image.original_name || 'unbekannt'}`,
      image: (() => {
        // Use SEO-friendly URL with slug-based filename
        const imagePath = image.path_2048 || image.path_512;
        if (!imagePath || !image.slug) return '';
        const extensionMatch = imagePath.match(/\.(jpg|jpeg|webp|png)$/i);
        const fileExtension = extensionMatch ? extensionMatch[0].toLowerCase() : '.jpg';
        return `https://culoca.com/images/${image.slug}${fileExtension}`;
      })(),
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
