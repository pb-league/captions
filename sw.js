// CaptionClash Service Worker
const CACHE = 'captiondash-v1';
const PRECACHE = [
  '/',
  '/index.html',
  '/supabase-config.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;600&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
];

// Install: cache shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for API, cache-first for assets
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always go to network for Supabase API calls
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Cache-first for static assets
  if (e.request.method === 'GET') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(response => {
          // Cache successful responses for static assets
          if (response.ok && (url.origin === self.location.origin || url.hostname.includes('fonts.googleapis') || url.hostname.includes('jsdelivr'))) {
            const clone = response.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return response;
        }).catch(() => caches.match('/index.html'));
      })
    );
  }
});
