const CACHE = 'dubpack-studio-web-v40';
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './assets/dubpack-logo.jpg',
  './vendor/fflate.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => (
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    ))
  );
  self.clients.claim();
});

function shouldCache(request, response) {
  if (request.method !== 'GET') return false;
  if (!response || !response.ok || response.status !== 200) return false;
  if (response.type !== 'basic') return false;
  if (request.headers.has('range')) return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.includes('.tmp-')) return false;
  if (/\.(zip|webm|mp4|ogv|wav|mp3|m4a)$/i.test(url.pathname)) return false;
  return true;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (shouldCache(request, response)) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
  );
});
