const CACHE_NAME = 'busraj-games-v10';
const APP_SHELL = [
  '/',
  '/index.html',
  '/local',
  '/online',
  '/snakes',
  '/dice',
  '/zahra',
  '/jackaroo',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/assets/css/platform.css',
  '/assets/css/game-kit.css',
  '/assets/css/board-premium.css',
  '/assets/css/luxury-game-ui.css',
  '/assets/js/audio-manager.js',
  '/assets/js/luxury-game-ui.js',
  '/assets/js/platform.js',
  '/assets/js/board-online.js',
  '/assets/js/engines/snakes-engine.js',
  '/assets/js/engines/dice-engine.js',
  '/assets/js/engines/ludo-engine.js',
  '/assets/js/engines/jackaroo-engine.js',
  '/assets/sounds/round.wav',
  '/assets/sounds/reveal.wav',
  '/assets/sounds/launch.wav',
  '/assets/sounds/correct.wav',
  '/assets/sounds/wrong.wav',
  '/assets/sounds/duel.wav',
  '/assets/sounds_guess/knock.wav',
  '/assets/sounds_guess/camera.wav',
  '/assets/sounds_guess/applause.wav',
  '/assets/sounds_guess/engine.wav',
  '/assets/sounds_guess/keyboard.wav',
  '/assets/sounds_guess/water.wav',
  '/assets/sounds_guess/heartbeat.wav',
  '/assets/sounds_guess/clock.wav',
  '/assets/sounds_guess/rain.wav',
];

const EXTERNAL_MEDIA = [
  'https://upload.wikimedia.org/wikipedia/commons/0/0a/Banana_pic.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/1/1a/Cut_watermelon.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/3/30/Photography_Camera.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/4/4c/African_lions.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/6/69/Wristwatch.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/a/a1/Pineapple.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/d/d7/Cup_Coffee.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/e/e1/Strawberries.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/f/f2/Cat_image.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => { await cache.addAll(APP_SHELL); await Promise.allSettled(EXTERNAL_MEDIA.map(async (url) => { const response = await fetch(url, { mode: 'no-cors' }); await cache.put(url, response); })); }));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.hostname === 'upload.wikimedia.org') {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request, { mode: 'no-cors' }).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
      return response;
    })));
    return;
  }
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (!response || response.status !== 200 || response.type === 'opaque') return response;
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
      return response;
    }).catch(() => {
      if (event.request.mode === 'navigate') return caches.match('/');
      return Response.error();
    }))
  );
});
