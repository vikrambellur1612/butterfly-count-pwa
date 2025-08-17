// Service Worker for Butterfly Count PWA

const CACHE_NAME = 'butterfly-count-v1.6.7';
const STATIC_CACHE = 'butterfly-count-static-v1.6.1';
const DYNAMIC_CACHE = 'butterfly-count-dynamic-v1.6.1';

// Files to cache for offline functionality
const STATIC_FILES = [
  './',
  './index.html',
  './css/styles.css',
  './css/mobile.css',
  './js/app.js',
  './js/sw-register.js',
  './js/butterflies-data.js',
  './butterflies-data.json',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './icons/favicon.svg',
  './icons/favicon.png',
  './icons/apple-touch-icon-180x180.png',
  './icons/apple-touch-icon-152x152.png',
  './icons/apple-touch-icon-144x144.png',
  './icons/apple-touch-icon-120x120.png',
  './icons/favicon-32x32.png',
  './icons/favicon-16x16.png'
];

// Dynamic files that can be cached as needed
const DYNAMIC_FILES = [
  './icons/',
  './css/',
  './js/'
];

// Files that should always be fetched from network
const NETWORK_FIRST = [
  './api/',
  './data/'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('Butterfly Count Service Worker installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Caching static files...');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('Static files cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Failed to cache static files:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Butterfly Count Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Old caches cleaned up');
        return self.clients.claim();
      })
  );
});

// Fetch event - handle network requests with caching strategies
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET requests and non-HTTP(S) schemes
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }
  
  // Apply different caching strategies
  if (isStaticFile(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request));
  } else if (isNetworkFirstFile(url.pathname)) {
    event.respondWith(networkFirstStrategy(request));
  } else if (isDynamicFile(url.pathname)) {
    event.respondWith(staleWhileRevalidateStrategy(request));
  } else {
    event.respondWith(cacheFirstStrategy(request));
  }
});

// Cache First Strategy - Good for static assets
async function cacheFirstStrategy(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Cache First Strategy failed:', error);
    return getOfflineFallback(request);
  }
}

// Network First Strategy - Good for API calls
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    return cachedResponse || getOfflineFallback(request);
  }
}

// Stale While Revalidate Strategy - Good for frequently updated content
async function staleWhileRevalidateStrategy(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => null);
  
  return cachedResponse || fetchPromise;
}

// Helper functions
function isStaticFile(pathname) {
  return STATIC_FILES.some(file => pathname.includes(file.replace('./', ''))) ||
         pathname.endsWith('.css') || pathname.endsWith('.js') || 
         pathname.endsWith('.svg') || pathname.endsWith('.png');
}

function isNetworkFirstFile(pathname) {
  return NETWORK_FIRST.some(path => pathname.startsWith(path));
}

function isDynamicFile(pathname) {
  return DYNAMIC_FILES.some(path => pathname.startsWith(path));
}

async function getOfflineFallback(request) {
  if (request.mode === 'navigate') {
    const cache = await caches.open(STATIC_CACHE);
    return await cache.match('./index.html');
  }
  return new Response('Offline - Butterfly Count', { 
    status: 503,
    statusText: 'Service Unavailable'
  });
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'butterfly-sync') {
    event.waitUntil(handleButterflySync());
  }
});

async function handleButterflySync() {
  console.log('Background sync triggered for butterfly data');
  // Handle offline butterfly observations when back online
  try {
    const butterfliesDB = await openIndexedDB();
    // Sync pending observations
    console.log('Syncing butterfly observations...');
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// IndexedDB helper
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ButterflyCountDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('observations')) {
        const store = db.createObjectStore('observations', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('listId', 'listId', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('lists')) {
        const store = db.createObjectStore('lists', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

// Push notification handling
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-192x192.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'close', title: 'Dismiss' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Butterfly Count', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open' || event.action === '') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if (client.url === self.location.origin && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('./');
        }
      })
    );
  }
});
