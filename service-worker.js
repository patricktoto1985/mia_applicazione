const CACHE_NAME = 'grcc-race-control-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest?v=2',
  './icon-192.png?v=2',
  './icon-512.png?v=2'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('grcc-race-control-') && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Google Apps Script/CDN/external requests remain untouched.
  if (url.origin !== self.location.origin) return;

  // Always refresh manifest and app icons from network first.
  if (
    url.pathname.endsWith('/manifest.webmanifest') ||
    url.pathname.endsWith('/icon-192.png') ||
    url.pathname.endsWith('/icon-512.png')
  ) {
    event.respondWith(
      fetch(req, { cache: 'reload' })
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          return response;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // HTML/navigation: network first.
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          return response;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Other same-origin static assets: cache first.
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return response;
      });
    })
  );
});


/* GRCC Race Control - Notifiche Firebase */
importScripts(
  'https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js'
);

firebase.initializeApp({
  apiKey: 'AIzaSyC6_cvZcICon-unMDs2uCraG___Bn_Ln64',
  authDomain: 'grccf1esports-32e7a.firebaseapp.com',
  projectId: 'grccf1esports-32e7a',
  messagingSenderId: '669012371039',
  appId: '1:669012371039:web:83b4796b248d1bdaeaddea'
});

const grccMessaging = firebase.messaging();

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const target = new URL(
    event.notification.data?.url || '/',
    self.location.origin
  );

  if (target.origin !== self.location.origin) return;

  event.waitUntil(
    clients.openWindow(target.href)
  );
});
