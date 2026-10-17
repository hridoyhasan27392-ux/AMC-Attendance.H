/* AMC Attendance Service Worker */
"use strict";

const CACHE_NAME = "amc-attendance-v3";

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./config.js",
  "./app.js",
  "./manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        await Promise.all(
          APP_FILES.map(async file => {
            try {
              const response = await fetch(file, {
                cache: "reload"
              });

              if (response.ok) {
                await cache.put(file, response);
              }
            } catch (error) {
              console.warn("Cache skipped:", file, error);
            }
          })
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key =>
              key.startsWith("amc-attendance-") &&
              key !== CACHE_NAME
            )
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (
    request.method !== "GET" ||
    new URL(request.url).origin !== self.location.origin
  ) {
    return;
  }

  const url = new URL(request.url);
  const isAppFile =
    /\.(html|js|css|json)$/.test(url.pathname) ||
    url.pathname.endsWith("/");

  if (!isAppFile) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => cache.put(request, copy))
            .catch(error =>
              console.warn("Cache update failed:", error)
            );
        }

        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);

        if (cached) return cached;

        if (request.mode === "navigate") {
          const page = await caches.match("./index.html");
          if (page) return page;
        }

        return new Response(
          "ইন্টারনেট সংযোগ নেই। অনুগ্রহ করে আবার চেষ্টা করুন।",
          {
            status: 503,
            headers: {
              "Content-Type": "text/plain; charset=utf-8"
            }
          }
        );
      })
  );
});
