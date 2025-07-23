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