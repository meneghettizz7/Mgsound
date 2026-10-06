// Service Worker do MgSound.
// Versão alterada para evitar que o celular fique preso em uma versão antiga.
const CACHE_NAME = "mgsound-pwa-v10";

const APP_SHELL = [
  "./",
  "./index.html",
  "./login.html",
  "./cadastro.html",
  "./manifest.json",
  "./css/style.css",
  "./js/core/app.js",
  "./js/auth/auth.js",
  "./js/config/firebase.js",
  "./js/pwa/pwa.js",
  "./img/icon-192.png",
  "./img/icon-512.png",
  "./img/screenshot-wide.png",
  "./img/screenshot-mobile.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // HTML: sempre tenta a versão online primeiro.
  if (event.request.mode === "navigate" || event.request.destination === "document") {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then(cached =>
          cached || caches.match("./index.html")
        ))
    );
    return;
  }

  // CSS/JS/imagens: tenta rede primeiro para evitar versão antiga.
  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
