const CACHE_NAME = "srev 1.6.3.6";
const BASE_PATH = self.location.pathname.replace(/\/sw\.js$/, "");

self.addEventListener("install", (e) => {
  console.log("[SW] Installing service worker");
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  console.log("[SW] Activating service worker");
  e.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              console.log(`[SW] Deleting old cache ${key}`);
              return caches.delete(key);
            }
          })
        )
      ),
    ])
  );
});

self.addEventListener("fetch", (e) => {
  const url = e.request.url;
  const origin = self.origin;
  const basePath = origin + BASE_PATH;

  const matchPaths = ["/assets/", "/images/", "/index", "/manifest", "/hash"];
  const shouldCache =
    url === basePath + "/" ||
    url === basePath + "/index.html" ||
    (matchPaths.some((p) => url.startsWith(basePath + p)) && !url.includes("/assets/project.json") && !url.endsWith(".mp3") && !url.endsWith(".wav"));

  if (!shouldCache || e.request.method !== "GET") {
    return;
  }

  e.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Hash check logic
      if (url === basePath + "/hash") {
        try {
          const cached = await cache.match(e.request);
          const networkResponse = await fetch(e.request, { redirect: "follow" });
          if (networkResponse.ok) {
            cache.put(e.request, networkResponse.clone()).catch(() => {});
            if (cached) {
              const oldText = await cached.text();
              const newText = await networkResponse.clone().text();
              if (oldText !== newText) {
                console.log(`[SW] Hash changed, purging cache`);
                caches.delete(CACHE_NAME);
              }
            }
          }
          return networkResponse;
        } catch (err) {
          console.warn("[SW] Hash fetch failed", err);
        }
      }

      // Root / index.html logic: network first, fallback to cache
      if (url === basePath + "/" || url === basePath + "/index.html") {
        try {
          const networkResponse = await fetch(e.request, { redirect: "follow" });
          if (networkResponse.ok) {
            cache.put(e.request, networkResponse.clone()).catch(() => {});
            return networkResponse;
          }
        } catch (err) {
          console.warn("[SW] Index fetch failed, falling back to cache", err);
        }
      }

      // Cache first, network fallback with safe caching
      const cachedResponse = await cache.match(e.request);
      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const networkResponse = await fetch(e.request, { redirect: "follow" });
        if (networkResponse && networkResponse.ok) {
          cache.put(e.request, networkResponse.clone()).catch(() => {});
        }
        return networkResponse;
      } catch (err) {
        console.warn(`[SW] Fetch failed for ${url}`, err);
        return cachedResponse;
      }
    })
  );
});
