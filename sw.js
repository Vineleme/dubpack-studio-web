self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('dubpack-studio-web-v3').then((cache) => (
      cache.addAll(['./', './index.html', './styles.css', './app.js', './manifest.webmanifest', './assets/dubpack-logo.png'])
    ))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => (
      Promise.all(keys.filter((key) => key !== 'dubpack-studio-web-v3').map((key) => caches.delete(key)))
    ))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
