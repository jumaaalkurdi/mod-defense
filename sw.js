const VERSION = 'v3.0.1';
const SHELL_CACHE = 'shell-' + VERSION;
const RUNTIME_CACHE = 'runtime-' + VERSION;

const SHELL = [
  '/', '/index.html', '/styles.css', '/data.js', '/manifest.json',
  '/js/app.js', '/js/config.js', '/js/utils.js', '/js/auth.js',
  '/js/api.js', '/js/ui.js', '/js/admin.js', '/js/router.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== SHELL_CACHE && k !== RUNTIME_CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.hostname === 'api.github.com') return;
  if(url.hostname === 'raw.githubusercontent.com'){
    e.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }
  if(url.origin === location.origin){
    e.respondWith(caches.match(req).then(c => c || fetch(req).then(res => {
      const clone = res.clone();
      caches.open(RUNTIME_CACHE).then(cc => cc.put(req, clone)).catch(() => {});
      return res;
    }).catch(() => caches.match('/index.html'))));
  }
});
