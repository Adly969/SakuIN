/**
 * SakuIN Service Worker (PWA Shell & Offline Cache)
 * Sesuai PRD Seksi 6 & 14 (Minggu 6)
 */

const CACHE_NAME = "sakuin-pwa-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/logo-mark.png",
  "/logo.png",
  "/icon.png",
];

// Install: pre-cache essential static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches and take control
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Network-first with cache fallback for navigation, Stale-While-Revalidate for statics
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Ignore non-GET and external auth/API mutations
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip supabase auth or backend api requests from SW cache
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Navigation requests (HTML pages)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, cloned);
          });
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match("/");
          return fallback || Response.error();
        })
    );
    return;
  }

  // Static files: Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cloned = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, cloned);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
