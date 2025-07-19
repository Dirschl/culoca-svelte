/**
 * Single thumbnail / image information returned by the backend.
 */
export interface ImageThumb {
  id: string;
  /**
   * Publicly accessible URL of the thumbnail (max 512 px, JPEG/WEBP etc.).
   */
  thumbUrl: string;
  /** Image aspect ratio (width / height) */
  ratio: number;
}

/**
 * JSON payload returned by the `/images` backend endpoint.
 */
export interface FetchImagesResponse {
  /** List of thumbnails for the requested cell (can be empty). */
  images: ImageThumb[];
  /**
   * Total amount of thumbnails that exist for this cell on the server side.
   * If `0`, the cell is considered "empty" and should be cached accordingly.
   */
  count: number;
}

/**
 * Build the REST URL for the `GET /images` request.
 *
 * The backend understands the following query params:
 *  cell   – H3 index (required)
 *  limit  – maximum amount of thumbnails to return (default backend = 10)
 */
function buildUrl(cell: string, limit: number): string {
  const query = `cell=${cell}&limit=${limit}`;
  return `/images?${query}`;
}

/**
 * Fetch thumbnails for a specific H3 cell.
 *
 * @param cell   H3 index (resolution depends on zoom-level logic)
 * @param limit  Upper bound of thumbnails to fetch (max = 10)
 * @param signal Optional `AbortSignal` (for hard cancel when viewport jumps)
 *
 * @throws Will throw when the network request fails *or* when the backend
 *         responds with an unexpected payload.
 */
export async function fetchImages(
  cell: string,
  limit: number,
  signal?: AbortSignal
): Promise<FetchImagesResponse> {
  const response = await fetch(buildUrl(cell, limit), { signal });

  // HTTP 204 means *known empty cell* – shortcut to avoid JSON parsing.
  if (response.status === 204) {
    return { images: [], count: 0 };
  }

  if (!response.ok) {
    throw new Error(`fetchImages: HTTP ${response.status}`);
  }

  const json = (await response.json()) as Partial<FetchImagesResponse>;

  if (!Array.isArray(json.images) || typeof json.count !== 'number') {
    throw new Error('fetchImages: backend payload malformed');
  }

  return {
    images: json.images,
    count: json.count,
  };
} 