// Previous release marker retained for upgrade diagnostics: CACHE_NAME = 'busraj-games-v20'
// Previous release marker retained for upgrade diagnostics: CACHE_NAME = 'busraj-games-v21-reference-skin'
const CACHE_NAME = 'busraj-games-v22-v5-hub';
const MEDIA_CACHE = 'busraj-quiz-media-v3';
const APP_SHELL = [
  '/',
  '/index.html',
  '/v5',
  '/local',
  '/online',
  '/social',
  '/snakes',
  '/dice',
  '/zahra',
  '/jackaroo',
  '/memory',
  '/reaction',
  '/logic',
  '/puzzle',
  '/accuracy',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/assets/css/platform.css',
  '/assets/css/social.css',
  '/assets/css/game-kit.css',
  '/assets/css/board-premium.css',
  '/assets/css/luxury-game-ui.css',
  '/assets/css/mobile-game.css',
  '/assets/css/fullscreen-board.css',
  '/assets/css/snakes-premium.css',
  '/assets/css/snakes-v4-board.css',
  '/assets/css/snakes-v4-interactions.css',
  '/assets/css/snake-reference-skin.css',
  '/assets/css/zahra-premium.css',
  '/assets/css/jackaroo-next.css',
  '/assets/css/quiz-luxury.css',
  '/assets/css/quiz-board-v2.css',
  '/assets/js/audio-manager.js',
  '/assets/js/questions-data.js',
  '/assets/js/luxury-game-ui.js',
  '/assets/js/platform.js',
  '/assets/js/social-client.js',
  '/assets/js/adaptive-board-layout.js',
  '/assets/js/snakes-v4-fx.js',
  '/assets/js/fullscreen-game.js',
  '/assets/js/board-online.js',
  '/assets/js/engines/snakes-engine.js',
  '/assets/js/engines/dice-engine.js',
  '/assets/js/engines/ludo-engine.js',
  '/assets/js/engines/jackaroo-engine.js',
  '/assets/js/snake-pro-upgrade.js',
  '/assets/snake-reference-skin.png',
  '/assets/sounds/round.wav',
  '/assets/sounds/reveal.wav',
  '/assets/sounds/launch.wav',
  '/assets/sounds/correct.wav',
  '/assets/sounds/wrong.wav',
  '/assets/sounds/duel.wav',
];


self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => ![CACHE_NAME,MEDIA_CACHE].includes(key)).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && (url.pathname.startsWith('/assets/quiz_photos/') || url.pathname.startsWith('/assets/sounds_pro/'))) {
    event.respondWith(caches.open(MEDIA_CACHE).then(async (cache) => { const cached=await cache.match(event.request); if(cached)return cached; const response=await fetch(event.request); if(response?.ok)cache.put(event.request,response.clone()).catch(()=>{}); return response; }));
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
