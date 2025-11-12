// Utility functions for image handling
const SUPABASE_STORAGE_URL = 'https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public';

export function getImageUrl(image: any, size: '64' | '512' | '2048' = '512'): string {
  const bucket = `images-${size}`;
  
  // Determine the correct path based on size and format
  let path: string | null = null;
  
  switch (size) {
    case '64':
      path = image.path_64;
      break;
    case '512':
      path = image.path_512;
      break;
    case '2048':
      path = image.path_2048;
      break;
  }
  
  if (!path) {
    // Fallback to 512px if the requested size is not available
    if (size !== '512') {
      return getImageUrl(image, '512');
    }
    return '';
  }
  
  return `${SUPABASE_STORAGE_URL}/${bucket}/${path}`;
}

export function getImageUrls(image: any): {
  src: string;
  srcHD: string;
  thumbnail: string;
} {
  return {
    src: getImageUrl(image, '512'),
    srcHD: getImageUrl(image, '2048'),
    thumbnail: getImageUrl(image, '64')
  };
}

/**
 * Get SEO-friendly image URL with slug-based filename
 * This is useful for sitemaps and external links to improve SEO
 * @param image - Image object with slug and path_2048 or path_512
 * @param baseUrl - Base URL for the site (default: 'https://culoca.com')
 * @returns SEO-friendly URL like '/images/{slug}.jpg'
 */
export function getSeoImageUrl(image: any, baseUrl: string = 'https://culoca.com'): string {
  if (!image || !image.slug) {
    return '';
  }

  // Determine file extension from path_2048 or path_512
  const imagePath = image.path_2048 || image.path_512;
  if (!imagePath) {
    return '';
  }

  // Extract extension from the actual file path (e.g., "abc123.jpg" -> ".jpg")
  const extensionMatch = imagePath.match(/\.(jpg|jpeg|webp|png)$/i);
  const fileExtension = extensionMatch ? extensionMatch[0].toLowerCase() : '.jpg';

  // Return SEO-friendly URL with slug-based filename
  return `${baseUrl}/images/${image.slug}${fileExtension}`;
} 