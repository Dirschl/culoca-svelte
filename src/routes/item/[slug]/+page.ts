import type { PageLoad } from './$types';

export const load: PageLoad = async ({ data, url }) => {
  const image = data?.image;
  
  if (image) {
    // Add SEO meta tags to prevent Google from "stealing" nearby image titles/descriptions
    // Calculate dimensions for 2048px version (proportional scaling)
    const originalWidth = image.width || 2048;
    const originalHeight = image.height || 1365;
    const maxDimension2048 = 2048;
    const scale2048 = originalWidth > maxDimension2048 || originalHeight > maxDimension2048
      ? Math.min(maxDimension2048 / originalWidth, maxDimension2048 / originalHeight)
      : 1;
    const width2048 = Math.max(1, Math.min(Math.round(originalWidth * scale2048), maxDimension2048));
    const height2048 = Math.max(1, Math.min(Math.round(originalHeight * scale2048), maxDimension2048));
    
    const metaTags = {
      title: image.title || image.original_name || 'Bild',
      description: image.description || image.caption || `Bild von ${image.title || image.original_name || 'unbekannt'}`,
      image: (() => {
        // Use SEO-friendly URL with size suffix (no query parameters)
        const imagePath = image.path_2048 || image.path_512;
        if (!imagePath || !image.slug) return '';
        const extensionMatch = imagePath.match(/\.(jpg|jpeg|webp|png)$/i);
        const fileExtension = extensionMatch ? extensionMatch[0].toLowerCase() : '.jpg';
        // Prefer 2048px version, fallback to 512px
        return image.path_2048
          ? `https://culoca.com/images/${image.slug}-2048${fileExtension}`
          : `https://culoca.com/images/${image.slug}-512${fileExtension}`;
      })(),
      imageAlt: image.description || image.caption || `Bild von ${image.title || image.original_name || 'unbekannt'}`,
      url: url.toString().replace(/\/$/, '') + '/', // Ensure trailing slash
      author: image.full_name || 'Johann Dirschl',
      publishedTime: image.created_at || '',
      width: width2048, // Use 2048px dimensions, not original
      height: height2048 // Use 2048px dimensions, not original
    };

    return {
      ...data,
      metaTags
    };
  }

  return data;
};
