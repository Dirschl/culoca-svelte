import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const searchParams = url.searchParams;
  
  // Extract map parameters
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  const zoom = searchParams.get('zoom');
  const mapType = searchParams.get('map_type');
  const user = searchParams.get('user');
  
  return {
    mapParams: {
      lat: lat ? parseFloat(lat) : null,
      lon: lon ? parseFloat(lon) : null,
      zoom: zoom ? parseInt(zoom) : 13,
      mapType: mapType || 'standard',
      user: user || null
    }
  };
}; 