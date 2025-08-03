import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  // Get page parameter for pagination
  const page = parseInt(url.searchParams.get('page') || '1');
  const itemsPerPage = 50;

  // SEO-Daten serverseitig laden
  const seo = {
    title: 'Culoca - Entdecke die Welt durch Fotos',
    description: 'Culoca ist eine Plattform zum Entdecken und Teilen von Fotos mit GPS-Daten. Erstelle deine eigene Fotogalerie und erkunde die Welt durch die Augen anderer.',
    keywords: 'Fotografie, GPS, Galerie, Bilder, Entdeckung, Culoca',
    author: 'Culoca',
    robots: 'index, follow',
    language: 'de',
    geoRegion: 'DE',
    geoPosition: '51.1657;10.4515',
    icbm: '51.1657, 10.4515',
    ogTitle: 'Culoca - Entdecke die Welt durch Fotos',
    ogDescription: 'Culoca ist eine Plattform zum Entdecken und Teilen von Fotos mit GPS-Daten. Erstelle deine eigene Fotogalerie und erkunde die Welt durch die Augen anderer.',
    ogImage: '/culoca-logo-512px.png',
    ogImageAlt: 'Culoca Logo',
    ogType: 'website',
    ogUrl: 'https://culoca.com',
    twitterCard: 'summary_large_image',
    twitterTitle: 'Culoca - Entdecke die Welt durch Fotos',
    twitterDescription: 'Culoca ist eine Plattform zum Entdecken und Teilen von Fotos mit GPS-Daten.',
    twitterImage: '/culoca-logo-512px.png',
    canonicalUrl: 'https://culoca.com'
  };

  console.log('[Server] Loading basic page data...');
  
  return {
    seo,
    newsFlashItems: [],
    page,
    totalPages: Math.ceil(2200 / itemsPerPage),
    dbConnectionOk: false
  };
};