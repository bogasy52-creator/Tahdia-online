const CACHE_NAME = 'busraj-games-v5';
const APP_SHELL = [
  './',
  './index.html',
  './local.html',
  './online.html',
  './snakes.html',
  './dice.html',
  './zahra.html',
  './jackaroo.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './assets/css/platform.css',
  './assets/css/game-kit.css',
  './assets/css/board-premium.css',
  './assets/css/snakes-premium.css',
  './assets/css/jackaroo-premium.css',
  './assets/js/audio-manager.js',
  './assets/js/platform.js',
  './assets/js/engines/snakes-engine.js',
  './assets/js/engines/dice-engine.js',
  './assets/js/engines/ludo-engine.js',
  './assets/js/engines/jackaroo-engine.js',
  './assets/js/games/snakes-ui.js',
  './assets/js/games/jackaroo-ui.js',
  './assets/js/online/room-lobby.js',
  './assets/js/online/room-client.js',
  './assets/sounds/round.wav',
  './assets/sounds/reveal.wav',
  './assets/sounds/launch.wav',
  './assets/sounds/correct.wav',
  './assets/sounds/wrong.wav',
  './assets/sounds/duel.wav',
  './assets/sounds_guess/knock.wav',
  './assets/sounds_guess/camera.wav',
  './assets/sounds_guess/applause.wav',
  './assets/sounds_guess/engine.wav',
  './assets/sounds_guess/keyboard.wav',
  './assets/sounds_guess/water.wav',
  './assets/sounds_guess/heartbeat.wav',
  './assets/sounds_guess/clock.wav',
  './assets/sounds_guess/rain.wav',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
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
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (!response || response.status !== 200 || response.type === 'opaque') return response;
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
      return response;
    }).catch(() => {
      if (event.request.mode === 'navigate') return caches.match('./index.html');
      return Response.error();
    }))
  );
});
