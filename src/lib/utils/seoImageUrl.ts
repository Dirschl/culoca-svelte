/**
 * Utility function to generate SEO-friendly image URLs
 * Instead of: https://supabase.co/storage/.../uuid.jpg
 * Generate:   https://culoca.com/images/slug-512.jpg
 */

/**
 * Generate SEO-friendly image URL for culoca.com
 * @param slug - The image slug (e.g., "aussichtsturm-brotjacklriegel-...")
 * @param path - The storage path (e.g., "uuid.jpg") - used to extract extension
 * @param size - The image size ('512' | '2048')
 * @returns SEO-friendly URL or empty string if missing required params
 */
export function getSeoImageUrl(
  slug: string | undefined | null,
  path: string | undefined | null,
  size: '512' | '2048' = '512'
): string {
  if (!slug || !path) {
    return '';
  }
  
  const extensionMatch = path.match(/\.(jpg|jpeg|webp|png)$/i);
  const fileExtension = extensionMatch ? extensionMatch[0].toLowerCase() : '.jpg';
  
  return `https://culoca.com/images/${slug}-${size}${fileExtension}`;
}

/**
 * Get the file extension from a storage path
 * @param path - The storage path (e.g., "uuid.jpg")
 * @returns The extension including dot (e.g., ".jpg")
 */
export function getImageExtension(path: string | undefined | null): string {
  if (!path) return '.jpg';
  const match = path.match(/\.(jpg|jpeg|webp|png)$/i);
  return match ? match[0].toLowerCase() : '.jpg';
}
