self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('dubpack-studio-web-v10').then((cache) => (
      cache.addAll(['./', './index.html', './styles.css', './app.js', './manifest.webmanifest', './assets/dubpack-logo.png'])
    ))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => (
      Promise.all(keys.filter((key) => key !== 'dubpack-studio-web-v10').map((key) => caches.delete(key)))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open('dubpack-studio-web-v10').then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
