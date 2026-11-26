/**
 * SakuIN Service Worker (PWA Shell & Offline Cache)
 * Version: sakuin-pwa-v7 (Fresh Network-First strategy to eliminate stale page flashes)
 */

const CACHE_NAME = "sakuin-pwa-v7";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/app-icon.png",
  "/logo-mark.png",
  "/logo.png",
  "/icon.png",
];

// 1. Install: Pre-cache core icons and shell
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// 2. Activate: Immediately purge all older caches and take control
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[SW] Menghapus cache lama:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch: Network-First for Navigation, Next.js Chunks, and RSC to prevent stale UI
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip external origins and backend API mutations from SW cache
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Network-First for Navigation (HTML), Next.js build chunks, and React Server Components (RSC)
  const isNavigation = request.mode === "navigate";
  const isNextBundle = url.pathname.startsWith("/_next/");
  const isRSC = url.searchParams.has("_rsc");

  if (isNavigation || isNextBundle || isRSC) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cloned = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, cloned);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          if (isNavigation) {
            const fallback = await caches.match("/");
            return fallback || Response.error();
          }
          return Response.error();
        })
    );
    return;
  }

  // Stale-While-Revalidate only for static image / font assets
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

// 4. Push Notification Handler
self.addEventListener("push", (event) => {
  let data = {
    title: "SakuIN — Waktunya Catat Keuangan!",
    body: "Sudah mencatat pengeluaran hari ini? Yuk luangkan 10 detik agar batas harianmu tetap aman!",
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: "/logo-mark.png",
    badge: "/logo-mark.png",
    vibrate: [200, 100, 200],
    data: { url: data.url || "/dashboard" },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// 5. Notification Click Handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification && event.notification.data && event.notification.data.url) || "/dashboard";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("navigate" in client && typeof client.navigate === "function") {
            return client.navigate(targetUrl).then((c) => (c && "focus" in c ? c.focus() : client.focus()));
          }
          if ("focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
