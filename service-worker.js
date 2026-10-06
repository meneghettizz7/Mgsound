// O Service Worker controla cache e funcionamento básico do MgSound quando a conexão está instável ou indisponível.


// Nome da versão atual do cache. Ao mudar a versão, o cache antigo será removido.
const CACHE_NAME = "mgsound-pwa-v8";

// Arquivos principais que o navegador pode guardar para carregar a aplicação mais rapidamente.
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

// Executado quando uma nova versão do Service Worker é instalada.
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );

  self.skipWaiting();
});

// Executado quando o novo Service Worker assume o controle.
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

// Intercepta requisições para usar cache e rede de forma inteligente.
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;

    // Para páginas HTML, tenta primeiro a rede e usa o cache como alternativa.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, copy);
          });

          return response;
        })
        .catch(() =>
          caches.match(event.request).then(
            cached => cached || caches.match("./index.html")
          )
        )
    );

    return;
  }

    // Para imagens, CSS e JavaScript, usa o cache quando disponível e atualiza pela rede.
  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();

            caches.open(CACHE_NAME).then(cache =>
              cache.put(event.request, copy)
            );
          }

          return response;
        })
        .catch(() => cached); // Se a internet falhar, usa o cache existente.

      return cached || network;
    })
  );
});
