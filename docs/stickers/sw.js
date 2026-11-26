// Funciona sin internet y recibe archivos desde "Compartir" de Android.
const VERSION = 'stickers-v2';
const APP = ['./', 'index.html', 'styles.css', 'app.js', 'audio.js', 'webp.js', 'vendor/lame.min.js',
  'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(APP)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== 'share-inbox').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.pathname.endsWith('/compartir')) {
    e.respondWith((async () => {
      const form = await e.request.formData();
      const files = form.getAll('media').filter(f => f && f.size);
      const inbox = await caches.open('share-inbox');
      for (const k of await inbox.keys()) await inbox.delete(k);
      await Promise.all(files.map((f, i) => inbox.put(`./compartido/${i}`, new Response(f, {
        headers: { 'content-type': f.type || 'application/octet-stream', 'x-name': encodeURIComponent(f.name || 'archivo') },
      }))));
      return Response.redirect(`./?shared=${files.length}`, 303);
    })());
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Red primero (para tener siempre la última versión), caché si no hay internet
  e.respondWith(fetch(e.request).then(resp => {
    if (resp.ok) { const copy = resp.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
    return resp;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
