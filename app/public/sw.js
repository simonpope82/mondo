// mondo service worker: app shell cache + offline read cache for GET /api + web push
const SHELL = 'mondo-shell-v3';
const DATA = 'mondo-data-v1';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icon-192.png']))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => ![SHELL, DATA].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) {
    if ((url.pathname.startsWith('/api/auth') && url.pathname !== '/api/auth/me') || url.pathname.startsWith('/api/geocode') || url.pathname.startsWith('/api/push') || url.pathname.startsWith('/api/labels') || url.pathname.startsWith('/api/assets-report')) return;
    // network first, fall back to the last copy (read-only offline)
    e.respondWith(fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(DATA).then((c) => c.put(req, cp)); } return r; })
      .catch(() => caches.match(req).then((m) => m ? new Response(m.body, { status: 200, headers: { 'Content-Type': 'application/json', 'X-Mondo-Offline': '1' } }) : new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } }))));
    return;
  }
  if (url.pathname.startsWith('/assets/')) { // hashed files: cache first
    e.respondWith(caches.match(req).then((m) => m || fetch(req).then((r) => { const cp = r.clone(); caches.open(SHELL).then((c) => c.put(req, cp)); return r; })));
    return;
  }
  if (req.mode === 'navigate') { e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(SHELL).then((c) => c.put('/', cp)); return r; }).catch(() => caches.match('/'))); return; }
});
self.addEventListener('message', (e) => { if (e.data === 'clear-data') caches.delete(DATA); });
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data.json(); } catch { d = { title: 'mondo', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'mondo', { body: d.body || '', icon: '/icon-192.png', badge: '/icon-192.png', data: { url: d.url || '/#/home' }, tag: d.tag }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/#/home';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => { for (const c of cs) { if ('focus' in c) { c.navigate(url).catch(() => {}); return c.focus(); } } return self.clients.openWindow(url); }));
});
