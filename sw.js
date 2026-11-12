/* Garde l'application disponible hors connexion (brocante sans réseau). */
const C = 'fazerbleu-v7';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== C).map((x) => caches.delete(x)))).then(() => clients.claim())));
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  const put = (x) => { const c = x.clone(); caches.open(C).then((ch) => ch.put(r, c)); return x; };
  if (/\/images\//.test(r.url)) e.respondWith(caches.match(r).then((m) => m || fetch(r).then(put)));
  else e.respondWith(fetch(r).then(put).catch(() => caches.match(r)));
});
