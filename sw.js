const CACHE = 'dubpack-studio-web-v124';
const PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './js/boot.js',
  './js/constants.js',
  './js/state.js',
  './js/i18n-bridge.js',
  './js/utils.js',
  './js/auth.js',
  './js/credits.js',
  './js/pack.js',
  './js/playback.js',
  './js/recorder.js',
  './js/export.js',
  './js/persist.js',
  './js/ui.js',
  './i18n.js',
  './payments.js',
  './payments.config.js',
  './manifest.webmanifest',
  './assets/dubpack-logo.jpg',
  './assets/dubpack-logo-brand.jpg',
  './assets/studio-mic-neon.png',
  './vendor/fflate.min.js',
  './vendor/ogv/ogv-support.js',
  './vendor/ogv/ogv.js'
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
  const url = new URL(request.url);
  if (url.protocol === 'blob:' || url.protocol === 'data:') return;
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (shouldCache(request, response)) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => {
        if (cached) return cached;
        if (request.mode === 'navigate') return caches.match('./index.html');
        return Promise.reject(new Error('offline'));
      }))
  );
});
