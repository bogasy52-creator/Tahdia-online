// Previous release marker retained for upgrade diagnostics: CACHE_NAME = 'busraj-games-v20'
// Previous release marker retained for upgrade diagnostics: CACHE_NAME = 'busraj-games-v21-reference-skin'
// Previous release marker retained for upgrade diagnostics: CACHE_NAME = 'busraj-games-v23-v5-online-fix'
// Previous release marker retained for upgrade diagnostics: CACHE_NAME = 'busraj-games-v38-secure-bots-store-progression'
// Previous release marker retained for upgrade diagnostics: CACHE_NAME = 'busraj-games-v39-mythic-store-gameplay-fixes'
// Previous release marker retained for upgrade diagnostics: CACHE_NAME = 'busraj-games-v40-noir-navigation-recovery'
// Previous release marker retained for upgrade diagnostics: CACHE_NAME = 'busraj-games-v41-post-match-route-fix'
const CACHE_NAME = 'busraj-games-v42-canonical-match-navigation';
const MEDIA_CACHE = 'busraj-quiz-media-v3';
const BROWSER_MANAGED_MATCH_DOCUMENTS = new Set([
  '/matchmaking.html', '/online.html', '/snakes.html',
  '/zahra.html', '/jackaroo.html', '/spotdiff.html',
]);
// Kept as compatibility markers for older install checks. Runtime navigation
// resolves these aliases to their concrete HTML documents below.
const LEGACY_ROUTE_MARKERS = Object.freeze([
  '/v5', '/local', '/online', '/league', '/matchmaking', '/social', '/store',
  '/snakes', '/dice', '/zahra', '/jackaroo', '/memory', '/reaction', '/logic',
  '/puzzle', '/draw', '/secret', '/order', '/auction', '/cipher', '/spotdiff',
  '/letters', '/accuracy',
]);
const APP_SHELL = [
  '/',
  '/index.html',
  '/v5.html',
  '/local.html',
  '/online.html',
  '/league.html',
  '/matchmaking.html',
  '/social.html',
  '/store.html',
  '/navigation-error.html',
  '/snakes.html',
  '/dice.html',
  '/zahra.html',
  '/jackaroo.html',
  '/memory.html',
  '/reaction.html',
  '/logic.html',
  '/puzzle.html',
  '/draw.html',
  '/secret.html',
  '/order.html',
  '/auction.html',
  '/cipher.html',
  '/spotdiff.html',
  '/letters.html',
  '/accuracy.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/assets/css/platform.css',
  '/assets/css/home-shell.css',
  '/assets/css/quiz-polish.css',
  '/assets/css/quiz-pro-overrides.css',
  '/assets/css/spotdiff-pro.css',
  '/assets/css/store.css',
  '/assets/css/match-presentation.css',
  '/assets/css/snake-arena-pro.css',
  '/assets/css/snakes-motion-pro.css',
  '/assets/css/board-fullscreen-pro.css',
  '/assets/css/arcade.css',
  '/assets/css/new-games.css',
  '/assets/css/social.css',
  '/assets/css/game-kit.css',
  '/assets/css/pro-theme-v6.css',
  '/assets/css/board-premium.css',
  '/assets/css/luxury-game-ui.css',
  '/assets/css/mobile-game.css',
  '/assets/css/fullscreen-board.css',
  '/assets/css/snakes-premium.css',
  '/assets/css/snakes-v4-board.css',
  '/assets/css/snakes-v4-interactions.css',
  '/assets/css/snake-classic.css',
  '/assets/css/zahra-premium.css',
  '/assets/css/jackaroo-next.css',
  '/assets/css/quiz-luxury.css',
  '/assets/css/quiz-board-v2.css',
  '/assets/js/audio-manager.js',
  '/firebase-config.js',
  '/assets/js/firebase-online.js',
  '/assets/js/matchmaking.js',
  '/assets/js/match-game-selector.js',
  '/assets/js/quick-match-game.js',
  '/assets/js/questions-data.js',
  '/assets/js/luxury-game-ui.js',
  '/assets/js/platform.js',
  '/assets/js/progression.js',
  '/assets/js/store-catalog.js',
  '/assets/js/store.js',
  '/assets/js/bot-engine.js',
  '/assets/js/board-matchmaking.js',
  '/assets/js/match-presentation.js',
  '/assets/js/arcade-games.js',
  '/assets/js/memory-pro.js',
  '/assets/js/new-games.js',
  '/assets/js/engines/spotdiff-scenes.js',
  '/assets/js/social-client.js',
  '/assets/js/adaptive-board-layout.js',
  '/assets/js/snakes-v4-fx.js',
  '/assets/js/snakes-motion-engine.js',
  '/assets/js/snake-classic.js',
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

async function remember(request, response) {
  if (!response?.ok || response.type === 'opaque') return response;
  const copy = response.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
  return response;
}

async function recoverNavigation(request, failedResponse = null) {
  const url = new URL(request.url);
  const cleanPath = url.pathname.replace(/\/+$/, '') || '/';
  const hasDocumentExtension = /\/[^/]+\.[a-z0-9]+$/i.test(cleanPath);

  if (cleanPath !== '/' && !hasDocumentExtension) {
    const candidate = new URL(url.href);
    candidate.pathname = `${cleanPath}.html`;
    try {
      const recovered = await fetch(candidate.href);
      if (recovered?.ok) return remember(request, recovered);
    } catch {}
  }

  return (await caches.match('/navigation-error.html'))
    || (await caches.match('/index.html'))
    || failedResponse
    || Response.error();
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && (url.pathname.startsWith('/assets/quiz_photos/') || url.pathname.startsWith('/assets/sounds_pro/'))) {
    event.respondWith(caches.open(MEDIA_CACHE).then(async (cache) => { const cached=await cache.match(event.request); if(cached)return cached; const response=await fetch(event.request); if(response?.ok)cache.put(event.request,response.clone()).catch(()=>{}); return response; }));
    return;
  }
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Cloudflare canonicalizes these documents to extensionless URLs. Let the
  // browser follow that redirect directly; intercepting it can surface as
  // ERR_FAILED on Chromium-based mobile browsers after a match is found.
  if (event.request.mode === 'navigate' && BROWSER_MANAGED_MATCH_DOCUMENTS.has(url.pathname)) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request).then(async (cached) => {
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          return response?.ok ? remember(event.request, response) : recoverNavigation(event.request, response);
        } catch {
          return recoverNavigation(event.request);
        }
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      return remember(event.request, response);
    }).catch(() => {
      return Response.error();
    }))
  );
});
