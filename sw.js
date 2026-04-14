// CaptionClash Service Worker v4
const CACHE = 'captiondash-v4';
const PRECACHE = ['/', '/index.html', '/supabase-config.js', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(PRECACHE.map(url => c.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Hostnames/paths that must ALWAYS go straight to the network — never cache.
// This covers Supabase REST, Supabase Storage, Supabase Realtime,
// Supabase Edge Functions, HuggingFace, and Anthropic.
function shouldPassThrough(url) {
  return (
    url.hostname.includes('supabase.co') ||   // REST + Storage + Realtime + Functions
    url.hostname.includes('supabase.in') ||    // alternate Supabase domain
    url.hostname.includes('huggingface.co') ||
    url.hostname.includes('anthropic.com') ||
    url.hostname.includes('api-inference.huggingface.co')
  );
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Pass-through: network only, no caching, no cloning
  if (shouldPassThrough(url)) {
    e.respondWith(
      fetch(e.request).catch(() => {
        // Only return a JSON error stub for API calls (not image loads)
        if (e.request.headers.get('Accept')?.includes('application/json')) {
          return new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return Response.error();
      })
    );
    return;
  }

  // Only cache GET requests for same-origin and known safe CDNs
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;

      return fetch(e.request).then(response => {
        // Only cache successful, cacheable responses from safe origins
        const isSafeOrigin = (
          url.origin === self.location.origin ||
          url.hostname.includes('fonts.googleapis.com') ||
          url.hostname.includes('fonts.gstatic.com') ||
          url.hostname.includes('jsdelivr.net')
        );

        // Never try to cache opaque, error, or non-basic responses
        // response.type === 'basic' means same-origin; 'cors' is fine too
        const isCacheable = (
          response.ok &&
          isSafeOrigin &&
          (response.type === 'basic' || response.type === 'cors')
        );

        if (isCacheable) {
          // Clone BEFORE reading — cloning a used response throws the error you saw
          try {
            const toCache = response.clone();
            caches.open(CACHE).then(c => c.put(e.request, toCache));
          } catch {
            // Clone failed (e.g. opaque response) — just return without caching
          }
        }

        return response;
      }).catch(() => {
        // Offline fallback: return cached index for navigation requests
        if (e.request.mode === 'navigate') return caches.match('/index.html');
        return Response.error();
      });
    })
  );
});

// ── PUSH NOTIFICATIONS ───────────────────────────────────────────────────────
self.addEventListener('push', e => {
  let data = { title: 'CaptionClash ⚡', body: 'Something happened!', icon: '/icons/icon-192.png' };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    data.icon || '/icons/icon-192.png',
      badge:   '/icons/icon-192.png',
      vibrate: [200, 100, 200],
      data:    data.data || {},
      actions: [{ action: 'view', title: 'View Contest' }],
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      for (const c of cs) {
        if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus();
      }
      return clients.openWindow('/');
    })
  );
});
