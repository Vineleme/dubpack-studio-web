self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('dubpack-studio-web-v31').then((cache) => (
      cache.addAll([
        './',
        './index.html',
        './styles.css',
        './app.js',
        './manifest.webmanifest',
        './assets/dubpack-logo.jpg',
        './vendor/fflate.min.js'
      ])
    ))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => (
      Promise.all(keys.filter((key) => key !== 'dubpack-studio-web-v31').map((key) => caches.delete(key)))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && request.url.startsWith(self.location.origin)) {
          const copy = response.clone();
          caches.open('dubpack-studio-web-v31').then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
  );
});
