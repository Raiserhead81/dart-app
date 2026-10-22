// DartPro Service Worker: NETWORK-FIRST fuer App-Code/Navigation (nie cache-first!),
// Caller-Clips + Icons: cache-first, Offline-Fallback: App-Shell.
const VERSION = '1-0-1';
const SHELL = `dartpro-shell-${VERSION}`;
const ASSETS = `dartpro-assets-${VERSION}`;

const SHELL_FILES = [
  '/', '/index.html', '/manifest.json', '/css/app.css',
  '/js/app.js', '/js/util.js', '/js/board.js', '/js/charts.js', '/js/update.js',
  '/js/update-manual.js', '/js/caller-voice.js', '/js/api.js', '/js/sync.js',
  '/js/views/play.js', '/js/views/training.js', '/js/views/stats.js', '/js/views/profile.js',
  '/js/views/online.js', '/js/views/cricket-ui.js', '/js/views/onlinematch.js',
  '/js/core/segments.js', '/js/core/x01.js', '/js/core/cricket.js', '/js/core/training.js',
  '/js/core/checkout.js', '/js/core/stats.js', '/js/core/weeks.js', '/js/core/analysis.js',
  '/js/core/tips.js', '/js/core/storage.js', '/js/core/result.js', '/js/core/pad.js',
  '/js/core/benchmarks.js', '/js/core/caller.js', '/js/core/caller-sequence.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    await c.addAll(SHELL_FILES.map(u => new Request(u, { cache: 'reload' }))).catch(() => {});
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !k.startsWith('dartpro-')).map(k => caches.delete(k)));
    await Promise.all(keys.filter(k => k.startsWith('dartpro-') && k !== SHELL && k !== ASSETS).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

const CACHE_FIRST = [
  /\/caller\/.+\.(mp3|ogg)$/,
  /\/icons\//,
  /\.(png|jpg|svg|woff2)$/
];

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== location.origin) return;

  // /VERSION und sw.js: IMMER Netz, niemals Cache
  if (url.pathname === '/VERSION' || url.pathname === '/sw.js') {
    e.respondWith(fetch(e.request, { cache: 'no-store' }));
    return;
  }
  // API: immer Netz (kein Cache)
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).catch(() => new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  // Statische Assets + Caller-Clips: cache-first mit Netz-Update
  if (CACHE_FIRST.some(re => re.test(url.pathname))) {
    e.respondWith((async () => {
      const c = await caches.open(ASSETS);
      const hit = await c.match(e.request);
      const net = fetch(e.request).then(res => {
        if (res.ok) c.put(e.request, res.clone());
        return res;
      }).catch(() => hit);
      return hit || net;
    })());
    return;
  }
  // App-Code & Navigation: NETWORK-FIRST
  e.respondWith((async () => {
    try {
      const res = await fetch(e.request, { cache: 'no-store' });
      const c = await caches.open(SHELL);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    } catch (err) {
      const c = await caches.open(SHELL);
      const hit = await c.match(e.request) || await c.match('/') || await c.match('/index.html');
      if (hit) return hit;
      return new Response('Offline', { status: 503 });
    }
  })());
});
