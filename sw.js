/* Service worker – Le Mans Ultimate Strategia
   Cambia VERSION ad ogni aggiornamento dell'app per forzare il refresh della cache. */
const VERSION = 'v1';
const CACHE = 'lmu-' + VERSION;
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon-48.png',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './maskable-192.png',
  './maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('lmu-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Dati dinamici: mai in cache (Supabase, meteo, rete locale Pitwall)
  if (url.hostname.endsWith('supabase.co') || url.hostname.endsWith('open-meteo.com')) return;
  if (!/^https?:$/.test(url.protocol)) return;

  // Pagine: prima la rete, se offline la copia salvata
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Altre risorse (icone, font, libreria Supabase): dalla cache e aggiorna in background
  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req)
        .then(res => {
          if (res && (res.status === 200 || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || net;
    })
  );
});
