// Service Worker für Cache-Management
const CACHE_NAME = 'culoca-v' + Date.now();
const STATIC_CACHE = 'culoca-static-v1';

// Installationsevent
self.addEventListener('install', event => {
  // Sofort aktiv werden (alte Service Worker ersetzen)
  self.skipWaiting();
});

// Aktivierungsevent
self.addEventListener('activate', event => {
  event.waitUntil(
    // Alte Caches löschen
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Sofort Kontrolle über alle Clients übernehmen
      return self.clients.claim();
    })
  );
});

// Fetch-Event für Cache-Kontrolle
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Nur für unsere Domain
  if (url.origin !== self.location.origin) {
    return;
  }
  
  // JavaScript-Dateien mit Hash im Namen: aggressive Caching
  if (url.pathname.includes('_app/immutable/') && url.pathname.includes('-')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(event.request).then(response => {
          if (response) {
            return response;
          }
          return fetch(event.request).then(response => {
            // Nur erfolgreiche Responses cachen
            if (response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          });
        });
      })
    );
    return;
  }
  
  // HTML-Seiten: immer neu laden
  if (url.pathname.endsWith('/') || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request, {
        cache: 'no-cache'
      }).catch(() => {
        // Fallback zu gecachter Version wenn offline
        return caches.match(event.request);
      })
    );
    return;
  }
  
  // Standard: normaler Fetch
});

// Message-Handler für manuelle Cache-Updates
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
  }
}); 