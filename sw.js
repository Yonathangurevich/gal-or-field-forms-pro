// public/sw.js - Service Worker for PWA

const CACHE_NAME = 'field-forms-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Fetch event
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      );
    })
  );
});

// Push notification event
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'טופס חדש הגיע!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'פתח טופס',
        icon: '/icon-192.png'
      },
      {
        action: 'close',
        title: 'סגור',
        icon: '/icon-192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('טופס חדש!', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'explore') {
    // Open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});