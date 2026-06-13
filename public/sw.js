const CACHE_NAME = "absp-cache-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/favicon.ico",
  "/icon.png",
  "/apple-icon.png",
  "/absp-logo.png",
  "/absp-emblem.png"
];

// Install Event - cache core static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - service requests using a hybrid strategy
self.addEventListener("fetch", (event) => {
  // Only intercept GET requests, skip chrome extensions, APIs, and dashboard routes
  if (
    event.request.method !== "GET" ||
    event.request.url.startsWith("chrome-extension://") ||
    event.request.url.includes("/api/") ||
    event.request.url.includes("/admin/") ||
    event.request.url.includes("/dashboard/")
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh copy in the background to keep the cache updated
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {
            /* Ignore network errors in background update */
          });
        return cachedResponse;
      }

      // If not cached, fetch from network and cache for next time
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      });
    })
  );
});

// Push notification event listener
self.addEventListener("push", (event) => {
  let data = { title: "ABSP - Al-Biruni Study Point", body: "নতুন আপডেট এসেছে!" };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "ABSP - Al-Biruni Study Point", body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: "/icon.png",
    badge: "/icon.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/"
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event listener
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const targetUrl = event.notification.data.url || "/";
      for (const client of clientList) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
