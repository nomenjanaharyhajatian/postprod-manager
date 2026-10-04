/**
 * Service Worker — PostProd Manager
 * Met en cache l'intégralité de l'app shell (HTML/CSS/JS/icônes) au premier
 * chargement pour permettre un fonctionnement 100% hors-ligne ensuite.
 * Stratégie : cache-first avec repli réseau, et mise à jour du cache en
 * arrière-plan (stale-while-revalidate) pour ne jamais bloquer l'ouverture.
 */

const CACHE_NAME = 'postprod-cache-v5';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/utils.js',
  './js/db.js',
  './js/permissions.js',
  './js/store.js',
  './js/calc.js',
  './js/validation.js',
  './js/backup.js',
  './js/components.js',
  './js/sort.js',
  './js/security.js',
  './js/auth.js',
  './js/router.js',
  './js/pages/dashboard.js',
  './js/pages/projects.js',
  './js/pages/episodes.js',
  './js/pages/scenes.js',
  './js/pages/rushes.js',
  './js/pages/search.js',
  './js/pages/reports.js',
  './js/pages/settingsPage.js',
  './js/pages/backupPage.js',
  './js/pages/usersPage.js',
  './js/app.js',
  './icons/icon.svg',
  './icons/avatars/av1.svg',
  './icons/avatars/av2.svg',
  './icons/avatars/av3.svg',
  './icons/avatars/av4.svg',
  './icons/avatars/av5.svg',
  './icons/avatars/av6.svg',
  './icons/avatars/av7.svg',
  './icons/avatars/av8.svg',
  './icons/avatars/av9.svg',
  './icons/avatars/av10.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
